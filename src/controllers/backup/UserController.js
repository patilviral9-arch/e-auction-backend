const userschema = require('../models/Usermodel');
const bcrypt = require("bcrypt")
const mailSend      = require('../utils/Mailutil');
const sendResetMail = require('../utils/ResetMailutil')
const jwt = require("jsonwebtoken")
const secret = process.env.JWT_SECRET_KEY

const registerUser = async (req, res) => {
    try {
        // Safety check: Is there a body and a password?
        if (!req.body || !req.body.password) {
            return res.status(400).json({ 
                message: "Password is required to create an account." 
            });
        }

        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        
        // Use the spread operator to keep other fields but swap the plain password for hashed
        const savedUser = await userschema.create({ ...req.body,password: hashedPassword});
        res.status(201).json({
            message: "user created successfully",
            data: savedUser
        });
        // Determine the correct name based on the role
        const displayName = savedUser.role === 'business' 
            ? savedUser.businessName 
            : savedUser.firstName;

        try {
            await mailSend(savedUser.email, "Welcome to E-Auction!", displayName, "welcome");
        } catch (mailError) {
            console.error("Mail failed:", mailError);
            // We don't crash the app here because the user is already saved to DB
        }

    } catch (err) {
        console.error("Mongoose Error:", err);
        res.status(500).json({
            message: "error while creating user",
            err: err.message
        });
    }
};

const loginUser = async (req, res) => {
    const { email, password } = req.body
    const founduserfromemail = await userschema.findOne({ email: email })
    console.log(founduserfromemail)
    if(founduserfromemail){

        const ispasswordmatched =await bcrypt.compare(password,founduserfromemail.password)
        if(ispasswordmatched){

            const token = jwt.sign(founduserfromemail.toObject(),secret)

            res.status(200).json({
                message:"login sucess",
                token:token,
                data:founduserfromemail,
                role:founduserfromemail.role
            })
        }
        else{
            res.status(401).json({
                message:"invalid credentials"
            })
        }
    }
    else{
        res.status(404).json({
            message:"user not found"
        })
    }
}

const getallusers = async (req, res) => {
    try{
        const allusers = await userschema.find()
        res.status(200).json({
            message:"all users",
            data:allusers
        })
    }catch(err){
        res.status(500).json({
            message:"error while featching users",
            err:err.message
        })
    }
}

const updateUser = async (req, res) => {
  try {
    const updatedusers = await userschema.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },   // ← this line
      { new: true }
    );
    res.status(200).json({ message: "user updated sucessfullty", data: updatedusers });
  } catch(err) {
    res.status(500).json({ message: "error while updating user", err: err.message });
  }
}

const deleteUser =async (req,res)=>{
    try{
        const deltedusers = await userschema.findByIdAndDelete(req.params.id)
        res.status(200).json({
            message:"user deleted sucessfullty",
            data:deltedusers
        })
    }catch(err){
        res.status(500).json({
            message:"error while deleting user"
        })
    }
}

const getUser = async (req, res) => {
  try {
    const user = await userschema.findById(req.params.id);
    res.status(200).json({ message: "user found", data: user });
  } catch(err) {
    res.status(500).json({ message: "error fetching user", err: err.message });
  }
}

const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is not provided." });

    try {
        const foundUserFromEmail = await userschema.findOne({ email });
        if (!foundUserFromEmail) {
            return res.status(404).json({ message: "User not found." });
        }

        // Token expires in 15 minutes
        const token = jwt.sign(
            { _id: foundUserFromEmail._id, email: foundUserFromEmail.email },
            secret,
            { expiresIn: "15m" }
        );

        const resetUrl = `http://localhost:5173/resetpassword/${token}`;

        // Use dedicated reset mail util
        await sendResetMail(foundUserFromEmail.email, resetUrl);

        res.status(200).json({ message: "Reset link has been sent to your email." });

    } catch (err) {
        console.error("Forgot password error:", err);
        res.status(500).json({ message: "Server error.", err: err.message });
    }
};

const resetPassword = async(req,res)=>{

    const {newPassword,token} = req.body;
    try{

        const decodedUser = await jwt.verify(token,secret) //{userobject}
        const hashedPassword =await  bcrypt.hash(newPassword,10)
        const updatedUser = await userschema.findByIdAndUpdate(decodedUser._id,{password:hashedPassword})
        res.status(200).json({
            message:"password reset successfully !!",
        })


    }catch(err){
        console.log(err)
        res.status(500).json({
            message:"server error..",
            err:err
        })
    }
}

module.exports ={
    registerUser,
    loginUser,
    getallusers,
    updateUser,
    deleteUser,
    getUser,
    forgotPassword,
    resetPassword
}