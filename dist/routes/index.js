"use strict";
exports.__esModule = true;
var express = require("express");
var router = express.Router();
/* GET home page. */
router.get("/", function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.send("<h1 style='color:red;font-size:1rem;font-family:verdana'>ENCREUA'T SRV</h1>");
});
module.exports = router;
