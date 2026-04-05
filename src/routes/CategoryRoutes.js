const router = require("express").Router()
const CategoryController = require("../controllers/CategoryController")

router.post("/category",CategoryController.createCategory)
router.get("/categories",CategoryController.getAllCategory)
router.put("/category/:id",CategoryController.updateCategory)
router.delete("/category/:id",CategoryController.deleteCategory)

module.exports = router