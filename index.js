const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app=express()

const jwt=require('jsonwebtoken')


require('dotenv').config()

const cors = require('cors');
const port=process.env.port||5000


//middleWare
app.use(cors())
app.use(express.json())

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// console.log(process.env.STRIPE_SECRET_KEY,'secre');


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tgzt8q2.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const menuCollection=client.db("bistroDB").collection('menuCollection')
    const reviewsCollection=client.db("bistroDB").collection('reviewsCollection')
    const cartsCollection=client.db("bistroDB").collection('carts')
    const usersCollection=client.db("bistroDB").collection('users')
    const paymentsCollection=client.db("bistroDB").collection('payment')


//jwt
  
app.post('/jwt',async (req,res)=>{
  const user=req.body
  // console.log(user);
    const token=jwt.sign(user,process.env.JWT_SECRET,{expiresIn:'1h'})
    res.send({token})
})

//verify token middleware

const verifyToken=(req,res,next)=>{
  // console.log('inside verify token :',req.headers.authorizaton)
  if(!req.headers?.authorizaton){
     return res.status(401).send({message:'unauthorized access'})
  }

   const token=req.headers.authorizaton.split(' ')[1];
   jwt.verify(token, process.env.JWT_SECRET,(err, decoded)=> {
    if(err){
      return res.status(401).send({message:'unauthorized access'})
    }


    req.decoded=decoded
    next()
  });



}


//use verify admin after verify token

const verifyAdmin=async(req,res,next)=>{
  const email=req.decoded.email;
  const query={email:email}
  const user=await usersCollection.findOne(query)
  const isAdmin=user?.role==='admin'
  if(!isAdmin){
    return res.status(403).send({message:'forbidden access'})
  }
  next()
}





      
    //users related API's


    app.get('/users',verifyToken,verifyAdmin,async(req,res)=>{
     
         const result=await usersCollection.find().toArray()
        
         res.send(result)
    })


    app.get('/users/admin/:email',verifyToken,async(req,res)=>{
       const email=req.params.email;
       if(email!==req.decoded.email){
        return res.status(403).send({message:'forbidden Access'})
       }

       const query={email:email}
       const user=await usersCollection.findOne(query);
       let admin=false;
       if(user){
        admin=user?.role==='admin';
       }
       res.send({admin})
    })


    app.patch('/users/admin/:id',verifyToken,verifyAdmin,async(req,res)=>{
          const id=req.params.id;
          const filter={_id:new ObjectId(id)}

          const updatedDoc={
            $set:{
                   role:'admin'
            }
          }

          const result=await usersCollection.updateOne(filter,updatedDoc)
          res.send(result)
    })


    app.delete('/users/:id',verifyToken,verifyAdmin,async(req,res)=>{
        const id=req.params.id;

        const query= {_id:new ObjectId(id)}
        const result=await usersCollection.deleteOne(query)
        res.send(result)
    })





    app.post('/users',async(req,res)=>{
         const user=req.body;

         //insert email if user doesnot exists

         const query={email:user.email}
        //  console.log(user);
         const existingUser=await usersCollection.findOne(query)
         if(existingUser){
          return res.send({message:"user already exist",insertedId:null})
         }


         const result= await usersCollection.insertOne(user);
         res.send(result)
    })





    app.get('/menu',async(req,res)=>{
          const result=await menuCollection.find().toArray();
          res.send(result)
    })


    app.get('/menu/:id',verifyToken,async(req,res)=>{
           const id=req.params.id;
          //  console.log(id);
           const  query={_id : new ObjectId(id)}
           const result= await menuCollection.findOne(query)
           
           res.send(result)

    })


    app.delete('/menu/:id',verifyToken,async(req,res)=>{
             const id=req.params.id;
             const query={_id:new ObjectId(id)}
             const result=await menuCollection.deleteOne(query)
             res.send(result)
    } )

    app.post('/menu',verifyToken,async(req,res)=>{
           const menuItem=req.body;
           console.log(menuItem);
          const result=await menuCollection.insertOne(menuItem)
          res.send(result)
    })

    app.get('/reviews',async(req,res)=>{
          const result=await reviewsCollection.find().toArray();
          res.send(result)
          

    })

 

    //carts collection

    app.post('/carts',async(req,res)=>{
         const  cartItem=req.body;
        //  console.log(cartItem);
         const result= await cartsCollection.insertOne(cartItem)
         res.send(result)
    })

    app.get('/carts',async(req,res)=>{
          const email=req.query.email;
          const query={ userEmail:email}
          const result=await cartsCollection.find(query).toArray()
          res.send(result)
    })

    app.delete('/carts/:id',async(req,res)=>{
         const id=req.params.id;
         const query={_id:new ObjectId(id)}

         const result = await cartsCollection.deleteOne( query);
         res.send(result)
    })




    //payment intent

    app.post('/create-payment-intent',async(req,res)=>{
         const {price}=req.body;
          const amount=parseInt(price*100)
        //  console.log(amount,'amount inside the intent  <------------------');

          const paymentIntent=await stripe.paymentIntents.create({
               amount:amount,
               currency:'usd',
               payment_method_types:[
                'card'
               ]
          })

          res.send({
            clientSecret:paymentIntent.client_secret
          })

    })



    app.get('/payments/:email',verifyToken, async(req,res)=>{

      const query= {email:req.params.email}
      console.log(req.params.email);
      if(req.params.email!==req.decoded?.email){
             return res.status(403).send({message:'forbidden access'})
      }

          const result= await  paymentsCollection.find(query).toArray()
          res.send(result)
    })
   
   app.post('/payments',async(req,res)=>{
       const payment=req.body;
       const paymentResult=await paymentsCollection.insertOne(payment)



       console.log('payment info====>',payment);

       const query={_id:{
        $in:payment.cartIds.map(id=>new ObjectId(id))
       }}
         
       const deleteResult= await cartsCollection.deleteMany(query)
        res.send({paymentResult,deleteResult})
   })





    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);












app.get('/',(req,res)=>{
    res.send('boss is  sitting')
})

app.listen(port,()=>{
    console.log(`this server is going on port ${port}`);
} )