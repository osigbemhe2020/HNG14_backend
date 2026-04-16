const express = require("express");
const Stage1Controller = require("../controllers/stage1.controller");
const validateName = require("../middlewares/validateName");

const router = express.Router();

router.post("/profiles", validateName, Stage1Controller.createProfile);
router.get("/profiles", Stage1Controller.getAllProfiles);
router.get("/profiles/:id", Stage1Controller.getProfileById);
router.delete("/profiles/:id", Stage1Controller.deleteProfile);



module.exports = router;

