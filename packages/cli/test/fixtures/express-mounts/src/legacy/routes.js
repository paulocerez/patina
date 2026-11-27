const { Router } = require("express");
const router = Router();
router.get("/reports", (_req, res) => res.json([]));
module.exports = router;
