const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 5000;

/* middleware */
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
   res.send("dent care server is running");
});

/* Mongodb connection */

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@dentcare.z26tokd.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
   useNewUrlParser: true,
   useUnifiedTopology: true,
   serverApi: ServerApiVersion.v1,
});

const verifyJWT = (req, res, next) => {
   const authHeader = req.headers.authorization;
   if (!authHeader) {
      return res.status(401).send("Unauthorized Accessed");
   }
   const token = authHeader.split(" ")[1];
   jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
      if (err) {
         return res.status(403).send("Forbidden Access");
      }
      req.decoded = decoded;
      next();
   });
};

const run = async () => {
   try {
      const appointmentOptionCollection = client.db("dentCare").collection("appointmentOptions");
      const bookingsCollection = client.db("dentCare").collection("patientBookings");
      const usersCollection = client.db("dentCare").collection("users");

      /* Route to get jwt token */
      app.get("/jwt", async (req, res) => {
         const email = req.query.email;
         const user = await usersCollection.findOne({ email: email });
         if (user) {
            const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: "1d" });
            return res.send({ accessToken: token });
         }
         res.status(403).send("Unauthorized Access");
      });

      /* route to get all appointment options */
      //Use Aggregate to query multiple collection and then merge data
      app.get("/appointmentoptions", async (req, res) => {
         const date = req.query.date;
         const query = {};
         const options = await appointmentOptionCollection.find(query).toArray();

         /* get the booking for selected date */
         const bookingQuery = { appointmentDate: date };
         const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();
         options.forEach((option) => {
            const optionBooked = alreadyBooked.filter((book) => book.treatment === option.name);
            const bookedSlots = optionBooked.map((book) => book.slot);
            const remainingSlots = option.slots.filter((slot) => !bookedSlots.includes(slot));
            option.slots = remainingSlots;
         });
         res.send(options);
      });

      /* route to book an appointment and save to db */
      app.post("/bookings", async (req, res) => {
         const booking = req.body;
         const query = {
            appointmentDate: booking.appointmentDate,
            email: booking.email,
            treatment: booking.treatment,
         };
         const booked = await bookingsCollection.find(query).toArray();

         if (booked.length) {
            const message = `You already have a booking in ${booking.treatment} on ${booking.appointmentDate}`;
            return res.send({ acknowledged: false, message });
         }

         const result = await bookingsCollection.insertOne(booking);
         res.send(result);
      });

      /* route to get booking by specific user */
      app.get("/bookings", verifyJWT, async (req, res) => {
         const email = req.query.email;
         const decodedEmail = req.decoded.email;
         if (email !== decodedEmail) {
            return res.status(403).send("Forbidden Access");
         }
         const query = {
            email: email,
         };
         const bookings = await bookingsCollection.find(query).toArray();
         res.send(bookings);
      });

      /* create user collection */
      app.post("/users", async (req, res) => {
         const user = req.body;
         const result = await usersCollection.insertOne(user);
         res.send(result);
      });

      /* get all users */
      app.get("/users", async (req, res) => {
         const query = {};
         const users = await usersCollection.find(query).toArray();
         res.send(users);
      });

      /* get admin from all users */
      app.get("/users/admin/:email", async (req, res) => {
         const email = req.params.email;
         const query = { email: email };
         const user = await usersCollection.findOne(query);
         res.send({ isAdmin: user?.role === "admin" });
      });

      /* Update user role as admin */
      app.put("/users/admin/:id", verifyJWT, async (req, res) => {
         const decodedEmail = req.decoded.email;
         const query = { email: decodedEmail };
         const user = await usersCollection.findOne(query);
         if (user.role !== "admin") {
            return res.status(403).send({ message: "Forbidden Access" });
         }
         const id = req.params.id;
         const filter = { _id: ObjectId(id) };
         const options = { upsert: true };
         const updateDoc = {
            $set: {
               role: "admin",
            },
         };
         const result = await usersCollection.updateOne(filter, updateDoc, options);
         res.send(result);
      });
   } finally {
   }
};
run().catch((e) => console.error(e));

app.listen(port, () => {
   console.log(`server is running on port : ${port}`);
});
