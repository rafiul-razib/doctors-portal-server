const express = require ("express");
const { MongoClient } = require('mongodb');
const admin = require("firebase-admin");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();



const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function verifyToken(req, res, next){
  if(req.headers?.authorization?.startsWith('Bearer ')){
    const token = req.headers.authorization.split(' ')[1];
    console.log(token);
    try{
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email
    }
    catch{

    }
  }

  next()
}



// Middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gnvic.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function run() {
  try {
    await client.connect();
    console.log("database connected")
    const database = client.db("doctors_portal");
    const appointmentCollection = database.collection("appointments");
    const usersCollection = database.collection("users");
    // create a document to insert

    app.get('/appointments', async(req, res)=>{
      const email = req.query.email;
      const date = req.query.date;
      const query ={email: email, date:date};
      const cursor = appointmentCollection.find(query)
      const appointments = await cursor.toArray()
      res.json(appointments)
    })

    app.post('/appointments', async(req, res)=>{
      const appointment = req.body;
      const result = await appointmentCollection.insertOne(appointment);
      res.json(result)
    })

    app.post('/users', async(req, res)=>{
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.json(result)
    })

    app.put('/users', async(req,res)=>{
      const user = req.body;
      const filter = {email: user.email}
      const options = {upsert: true}
      const updateDoc = {
        $set: user
      }
      const result = await usersCollection.updateOne(filter, updateDoc, options)
      res.json(result)
    })

    app.put('/users/admin', verifyToken, async(req, res)=>{
      const user = req.body;
      console.log('put', req.decodedEmail)
      const requester = req.decodedEmail;
      const requesterAccount = await usersCollection.findOne(requester)
      if(requester){
        if(requesterAccount.role === 'admin'){
          const filter = {email : user.email};
        const updateDoc = {
          $set : {
            role: "admin"
          }
        }
        const result = await usersCollection.updateOne(filter, updateDoc)
        res.json(result)
        }
      }
      else{
        requester.status(403)({message: "You are not authorized to make admin."})
      }
      
      
    })

    app.get('/user/:email', async(req,res)=>{
      const email = req.params.email;
      const query = {email: email};
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if(user?.role === "admin"){
        isAdmin = true
      }
      res.json({admin: isAdmin})
    })
  
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);





app.get('/', (req,res)=>{
    res.send("Hello docs")
})

app.listen(port, ()=>{
    console.log("Listening to the port", port)
})