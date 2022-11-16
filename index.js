const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
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

const run = async () => {
   try {
      const appointmentOptionCollection = client.db("dentCare").collection("appointmentOptions");
      const bookingsCollection = client.db("dentCare").collection("patientBookings");

      /* route to get all appointment options */
      //Use Aggregate to query multiple collection and then merge data
      app.get("/appointmentoptions", async (req, res) => {
         const date = req.query.date;
         console.log(date);
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
         console.log(booking);
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
   } finally {
   }
};
run().catch((e) => console.error(e));

app.listen(port, () => {
   console.log(`server is running on port : ${port}`);
});
