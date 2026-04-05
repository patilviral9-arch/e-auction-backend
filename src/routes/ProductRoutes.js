const router = require("express").Router()
const productController = require("../controllers/ProductController")

router.post("/product",productController.createProduct)
router.get("/products",productController.getAllProducts)
router.put("/product/:id",productController.updateproduct)
router.delete("/product/:id",productController.deleteproduct)

module.exports = router