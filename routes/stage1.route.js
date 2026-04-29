const express = require("express");
const Stage1Controller = require("../controllers/stage1.controller");
const validateName = require("../middlewares/validateName");
const { checkRole } = require('../middlewares/role.middleware');

const router = express.Router();

// Admin only — create and delete
router.post("/profiles", checkRole(['admin']), validateName, Stage1Controller.createProfile);
router.delete("/profiles/:id", checkRole(['admin']), Stage1Controller.deleteProfile);

// Both roles — read and search
// search must come before /:id to prevent route shadowing
router.get("/profiles/search", Stage1Controller.searchProfiles);
router.get("/profiles/export", Stage1Controller.exportProfiles);
router.get("/profiles", Stage1Controller.getAllProfiles);
router.get("/profiles/:id", Stage1Controller.getProfileById);

module.exports = router;