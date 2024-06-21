const express = require("express");
const app = express();
const port = 8080;
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const path = require("path");
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/assets", express.static(path.join(__dirname, "assets")));

app.set("view engine", "ejs");
app.post("/users", function (req, res) {});

// 매물CRUD
app.post("/properties", function (req, res) {});
app.put("/properties:/properties_id", function (req, res) {});
app.delete("/properties:/properties_id", function (req, res) {});
app.get("/properties", function (req, res) {});
app.patch("/properties/property_id/status", function (req, res) {});
app.post("/property-photos", function (req, res) {});
app.delete("/property-photos:/property_photo_id", function (req, res) {});

// 옵션
app.get("/options", function (req, res) {});

// 가격
app.get("/prices/:price_id", function (req, res) {});
app.put("/prices/:price_id", function (req, res) {});
app.get("/prices", function (req, res) {});

// 평수
app.post("/areas", function (req, res) {});
app.get("/areas", function (req, res) {});

// 거래내역
app.post("/transactions", function (req, res) {});
app.get("/transactions", function (req, res) {});

// 준공사
app.post("/construction-companies", function (req, res) {});
app.delete(
  "/construction-companies/:construction_company_id",
  function (req, res) {}
);
app.get("/construction-companies", function (req, res) {});

// 페이지 구현
app.listen(port, () => {
  console.log(`server is ready.. http://127.0.0.1:${port}/`);
});

app.get("/", function (req, res) {
  res.render("index.ejs");
});
