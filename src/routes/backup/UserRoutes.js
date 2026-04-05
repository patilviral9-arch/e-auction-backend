const router = require("express").Router()
const userController = require("../controllers/UserController")


router.post("/register",userController.registerUser)
router.post("/login",userController.loginUser)
router.get("/getusers",userController.getallusers)
router.put("/updateuser/:id",userController.updateUser)
router.delete("/deleteuser/:id",userController.deleteUser)
router.get("/getuser/:id", userController.getUser)
router.post("/forgetpassword",userController.forgotPassword)
router.put("/resetpassword",userController.resetPassword)
module.exports = router