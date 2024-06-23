const express = require("express");
const app = express();
const port = 8080;
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
const dotenv = require("dotenv");
const multer = require("multer");
const flash = require("connect-flash");
const districts = {
  서울: ["종로구", "중구", "용산구", "성동구"],
  부산: ["해운대구", "수영구", "부산진구", "동래구"],
  인천: ["남구", "부평구", "계양구", "연수구"],
  대구: ["중구", "동구", "서구", "남구"],
  // Add other cities and their districts as needed
};

const towns = {
  종로구: ["가회동", "계동", "와룡동"],
  중구: ["필동", "광희동", "신당동"],
  용산구: ["이태원동", "한남동", "효창동"],
  성동구: ["행당동", "왕십리동", "사근동"],
  해운대구: ["좌동", "우동", "송정동"],
  수영구: ["남천동", "수영동", "광안동"],
  부산진구: ["부전동", "범천동", "연지동"],
  동래구: ["안락동", "명장동", "온천동"],
  남구: ["문학동", "주안동", "관교동"],
  부평구: ["부평동", "청천동", "삼산동"],
  계양구: ["계산동", "작전동", "효성동"],
  연수구: ["송도동", "연수동", "청학동"],
  중구: ["남산동", "동인동", "수성동"],
  동구: ["신암동", "비산동", "안심동"],
  서구: ["내당동", "달서동", "평리동"],
  남구: ["대명동", "대봉동", "이천동"],
  // Add other districts and their towns as needed
};

// 환경 변수 설정 파일 로드
dotenv.config();

const connection = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "1q2w3e4r!",
  database: "realestate",
});
connection.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    return;
  }
  console.log("Connected to MySQL");
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // JSON 형태의 요청을 파싱하기 위해 추가
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);
app.use(flash());

app.set("view engine", "ejs");

// 파일 업로드 설정
const storage = multer.memoryStorage();

const upload = multer({ storage: storage });

// 로그인 확인 미들웨어
function isLoggedIn(req, res, next) {
  if (req.session.user) {
    return next();
  } else {
    res.redirect("/login");
  }
}

// 회원가입 처리
app.post("/users", async (req, res) => {
  const { name, email, pw, account, address } = req.body;

  try {
    const query =
      "INSERT INTO users (name, email, pw, account, address) VALUES (?, ?, ?, ?, ?)";
    connection.query(
      query,
      [name, email, pw, account, address],
      (err, results) => {
        if (err) {
          console.error("Error inserting user:", err.message);
          req.flash("error", "회원가입에 실패했습니다.");
          return res.redirect("/register");
        }

        req.flash("success", "회원가입에 성공했습니다. 로그인 해주세요.");
        res.redirect("/login");
      }
    );
  } catch (error) {
    console.error("Error during registration:", error);
    req.flash("error", "회원가입에 실패했습니다.");
    res.redirect("/register");
  }
});

// 로그인 페이지 렌더링
app.get("/login", (req, res) => {
  const user = req.session.user || null;
  res.render("login", { user });
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).send("Error logging out");
    }
    res.redirect("/");
  });
});
app.get("/register", (req, res) => {
  const user = req.session.user || null;
  res.render("register", { user });
});

// 로그인 요청 처리
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const query = "SELECT * FROM users WHERE email = ? AND pw = ?";
  connection.query(query, [email, password], (err, results) => {
    if (err) {
      console.error("Error checking user credentials:", err.message);
      res.status(500).send("Error checking user credentials: " + err.message);
      return;
    }

    if (results.length > 0) {
      const user = results[0];
      req.session.user = {
        id: user.user_id,
        email: user.email,
        name: user.name,
        account: user.account,
        address: user.address,
      };
      res.redirect("/");
    } else {
      res.status(401).send("Invalid email or password");
    }
  });
});

// 매물 등록 페이지
app.get("/enter", isLoggedIn, function (req, res) {
  const user = req.session.user || null;
  res.render("enter.ejs", { user });
});

// 매물 저장
app.post("/save", isLoggedIn, upload.array("photos"), function (req, res) {
  const {
    name,
    description,
    build_year,
    total_floors,
    floor,
    city,
    district,
    town,
    detail_address,
    construction_company_name,
    options = [],
    nearest_subway_station,
    security_options = [],
    monthly_rent,
    deposit,
    maintenance_fee,
    sale_price,
    brokerage_fee,
    recent_transaction_price,
    price_per_py,
    supply_area,
    exclusive_area,
    property_type, // 매물 종류 추가
  } = req.body;

  const statusValue = true; // Default to '판매중'
  const user_id = req.session.user.id;

  const addressQuery =
    "SELECT address_id FROM Addresses WHERE city = ? AND district = ? AND town = ? AND detail_address = ?";
  connection.query(
    addressQuery,
    [city, district, town, detail_address],
    (err, addressResults) => {
      if (err) {
        console.error("Error checking address:", err.message);
        res.status(500).send("Error checking address: " + err.message);
        return;
      }

      if (addressResults.length === 0) {
        const insertAddressQuery =
          "INSERT INTO Addresses (city, district, town, detail_address) VALUES (?, ?, ?, ?)";
        connection.query(
          insertAddressQuery,
          [city, district, town, detail_address],
          (err, insertResults) => {
            if (err) {
              console.error("Error inserting address:", err.message);
              res.status(500).send("Error inserting address: " + err.message);
              return;
            }

            const address_id = insertResults.insertId;
            handleConstructionCompany(address_id);
          }
        );
      } else {
        const address_id = addressResults[0].address_id;
        handleConstructionCompany(address_id);
      }
    }
  );

  function handleConstructionCompany(address_id) {
    const constructionCompanyQuery =
      "SELECT construction_company_id FROM ConstructionCompanies WHERE name = ?";
    connection.query(
      constructionCompanyQuery,
      [construction_company_name],
      (err, companyResults) => {
        if (err) {
          console.error("Error checking construction company:", err.message);
          res
            .status(500)
            .send("Error checking construction company: " + err.message);
          return;
        }

        if (companyResults.length === 0) {
          const insertCompanyQuery =
            "INSERT INTO ConstructionCompanies (name) VALUES (?)";
          connection.query(
            insertCompanyQuery,
            [construction_company_name],
            (err, insertCompanyResults) => {
              if (err) {
                console.error(
                  "Error inserting construction company:",
                  err.message
                );
                res
                  .status(500)
                  .send("Error inserting construction company: " + err.message);
                return;
              }

              const construction_company_id = insertCompanyResults.insertId;
              insertProperty(address_id, construction_company_id);
            }
          );
        } else {
          const construction_company_id =
            companyResults[0].construction_company_id;
          insertProperty(address_id, construction_company_id);
        }
      }
    );
  }

  function insertProperty(address_id, construction_company_id) {
    const insertPropertyQuery =
      "INSERT INTO Properties (name, description, build_year, total_floors, floor, address_id, construction_company_id, user_id, status, property_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    connection.query(
      insertPropertyQuery,
      [
        name,
        description,
        build_year,
        total_floors,
        floor,
        address_id,
        construction_company_id,
        user_id,
        statusValue,
        property_type, // 매물 종류 추가
      ],
      (err, propertyResults) => {
        if (err) {
          console.error("Error inserting property:", err.message);
          res.status(500).send("Error inserting property: " + err.message);
          return;
        }

        const property_id = propertyResults.insertId;

        insertPropertyPhotos(property_id);
        insertOptions(property_id);
        insertSecurityOptions(property_id);
        insertPrices(property_id, property_type); // 매물 종류와 함께 가격 삽입
        insertAreas(property_id);

        // 매물 등록 성공 메시지 설정 및 리다이렉션
        req.flash("success", "매물이 성공적으로 등록되었습니다.");
        res.redirect("/");
      }
    );
  }

  function insertPropertyPhotos(property_id) {
    if (req.files && req.files.length > 0) {
      const insertPhotoQuery =
        "INSERT INTO PropertyPhotos (property_id, photo, mime_type) VALUES (?, ?, ?)";

      req.files.forEach((file) => {
        connection.query(
          insertPhotoQuery,
          [property_id, file.buffer, file.mimetype], // file.buffer와 file.mimetype를 저장
          (err) => {
            if (err) {
              console.error("Error inserting photo:", err.message);
            }
          }
        );
      });
    }
  }

  function insertOptions(property_id) {
    const optionValues = {
      refrigerator: options.includes("refrigerator"),
      tv: options.includes("tv"),
      air_conditioner: options.includes("air_conditioner"),
      washing_machine: options.includes("washing_machine"),
      bed: options.includes("bed"),
      parking: options.includes("parking"),
      near_subway: options.includes("near_subway"),
      nearest_subway_station: nearest_subway_station || "",
    };

    const insertOptionsQuery =
      "INSERT INTO Options (property_id, refrigerator, tv, air_conditioner, washing_machine, bed, parking, near_subway, nearest_subway_station) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    connection.query(
      insertOptionsQuery,
      [
        property_id,
        optionValues.refrigerator,
        optionValues.tv,
        optionValues.air_conditioner,
        optionValues.washing_machine,
        optionValues.bed,
        optionValues.parking,
        optionValues.near_subway,
        optionValues.nearest_subway_station,
      ],
      (err) => {
        if (err) {
          console.error("Error inserting options:", err.message);
        }
      }
    );
  }

  function insertSecurityOptions(property_id) {
    const securityValues = {
      cctv: security_options.includes("cctv"),
      security_system: security_options.includes("security_system"),
    };

    const insertSecurityOptionsQuery =
      "INSERT INTO SecurityOptions (property_id, cctv, security_system) VALUES (?, ?, ?)";
    connection.query(
      insertSecurityOptionsQuery,
      [property_id, securityValues.cctv, securityValues.security_system],
      (err) => {
        if (err) {
          console.error("Error inserting security options:", err.message);
        }
      }
    );
  }

  function insertPrices(property_id, property_type) {
    const priceValues = {
      monthly_rent: monthly_rent || null,
      deposit: deposit || null,
      maintenance_fee: maintenance_fee || null,
      sale_price: sale_price || null,
      brokerage_fee: brokerage_fee || null,
      recent_transaction_price: recent_transaction_price || null,
      price_per_py: price_per_py || null,
    };

    const insertPricesQuery =
      "INSERT INTO Prices (property_id, monthly_rent, deposit, maintenance_fee, sale_price, brokerage_fee, recent_transaction_price, price_per_py) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    connection.query(
      insertPricesQuery,
      [
        property_id,
        priceValues.monthly_rent,
        priceValues.deposit,
        priceValues.maintenance_fee,
        priceValues.sale_price,
        priceValues.brokerage_fee,
        priceValues.recent_transaction_price,
        priceValues.price_per_py,
      ],
      (err) => {
        if (err) {
          console.error("Error inserting prices:", err.message);
        }
      }
    );
  }

  function insertAreas(property_id) {
    const areaValues = {
      supply_area: supply_area || null,
      exclusive_area: exclusive_area || null,
      exclusive_ratio: exclusive_area / supply_area || null, // 전용률 자동 계산
    };

    const insertAreasQuery =
      "INSERT INTO Areas (property_id, supply_area, exclusive_area, exclusive_ratio) VALUES (?, ?, ?, ?)";
    connection.query(
      insertAreasQuery,
      [
        property_id,
        areaValues.supply_area,
        areaValues.exclusive_area,
        areaValues.exclusive_ratio,
      ],
      (err) => {
        if (err) {
          console.error("Error inserting areas:", err.message);
        }
      }
    );
  }
});

app.get("/", (req, res) => {
  const user = req.session.user || null;
  const successMsg = req.flash("success");

  const query = `
    SELECT p.*, a.city, a.district, a.town, a.detail_address,
    (SELECT pp.photo FROM PropertyPhotos pp WHERE pp.property_id = p.property_id LIMIT 1) as photo,
    (SELECT pp.mime_type FROM PropertyPhotos pp WHERE pp.property_id = p.property_id LIMIT 1) as mime_type
    FROM Properties p
    JOIN Addresses a ON p.address_id = a.address_id
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching properties:", err.message);
      res.status(500).send("Error fetching properties");
      return;
    }

    const properties = results.map((property) => {
      if (property.photo) {
        property.photo = property.photo.toString("base64");
      }
      return property;
    });

    res.render("index", { user, successMsg, properties });
  });
});

app.get("/property/:id", (req, res) => {
  const propertyId = req.params.id;
  const user = req.session.user || null;
  const query = `
    SELECT p.*, a.city, a.district, a.town, a.detail_address, u.name as user_name, cc.name as construction_company_name,
    (SELECT pp.photo FROM PropertyPhotos pp WHERE pp.property_id = p.property_id LIMIT 1) as photo,
    (SELECT pp.mime_type FROM PropertyPhotos pp WHERE pp.property_id = p.property_id LIMIT 1) as mime_type
    FROM Properties p
    JOIN Addresses a ON p.address_id = a.address_id
    JOIN Users u ON p.user_id = u.user_id
    JOIN ConstructionCompanies cc ON p.construction_company_id = cc.construction_company_id
    WHERE p.property_id = ?
  `;

  connection.query(query, [propertyId], (err, results) => {
    if (err) {
      console.error("Error fetching property details:", err.message);
      res.status(500).send("Error fetching property details");
      return;
    }

    if (results.length === 0) {
      res.status(404).send("Property not found");
      return;
    }

    const properties = results.map((property) => {
      if (property.photo) {
        property.photo = property.photo.toString("base64");
      }
      return property;
    });

    res.render("property", { properties, user });
  });
});

// DELETE 매물
app.delete("/property/delete/:id", (req, res) => {
  const propertyId = req.params.id;

  // Define the queries to delete data from all related tables
  const deletePropertyPhotosQuery =
    "DELETE FROM PropertyPhotos WHERE property_id = ?";
  const deleteOptionsQuery = "DELETE FROM Options WHERE property_id = ?";
  const deleteSecurityOptionsQuery =
    "DELETE FROM SecurityOptions WHERE property_id = ?";
  const deletePricesQuery = "DELETE FROM Prices WHERE property_id = ?";
  const deleteAreasQuery = "DELETE FROM Areas WHERE property_id = ?";
  const deletePropertyQuery = "DELETE FROM Properties WHERE property_id = ?";

  // Execute the queries in sequence to ensure all related data is deleted
  connection.query(deletePropertyPhotosQuery, [propertyId], (err, results) => {
    if (err) {
      console.error("Error deleting property photos:", err.message);
      res.status(500).send("Error deleting property photos");
      return;
    }

    connection.query(deleteOptionsQuery, [propertyId], (err, results) => {
      if (err) {
        console.error("Error deleting options:", err.message);
        res.status(500).send("Error deleting options");
        return;
      }

      connection.query(
        deleteSecurityOptionsQuery,
        [propertyId],
        (err, results) => {
          if (err) {
            console.error("Error deleting security options:", err.message);
            res.status(500).send("Error deleting security options");
            return;
          }

          connection.query(deletePricesQuery, [propertyId], (err, results) => {
            if (err) {
              console.error("Error deleting prices:", err.message);
              res.status(500).send("Error deleting prices");
              return;
            }

            connection.query(deleteAreasQuery, [propertyId], (err, results) => {
              if (err) {
                console.error("Error deleting areas:", err.message);
                res.status(500).send("Error deleting areas");
                return;
              }

              connection.query(
                deletePropertyQuery,
                [propertyId],
                (err, results) => {
                  if (err) {
                    console.error("Error deleting property:", err.message);
                    res.status(500).send("Error deleting property");
                    return;
                  }

                  req.flash("success", "매물이 성공적으로 삭제되었습니다.");
                  res.status(200).send("Property deleted successfully");
                }
              );
            });
          });
        }
      );
    });
  });
});
// 수정 필드
app.get("/edit/:id", isLoggedIn, (req, res) => {
  const propertyId = req.params.id;
  const user = req.session.user || null;
  const query = `
    SELECT p.*, u.name as user_name, c.name as construction_company_name,
    GROUP_CONCAT(CONCAT('data:', pp.mime_type, ';base64,', TO_BASE64(pp.photo)) SEPARATOR ',') AS photos,
    (SELECT o.refrigerator FROM Options o WHERE o.property_id = p.property_id) as refrigerator,
    (SELECT o.tv FROM Options o WHERE o.property_id = p.property_id) as tv,
    (SELECT o.air_conditioner FROM Options o WHERE o.property_id = p.property_id) as air_conditioner,
    (SELECT o.washing_machine FROM Options o WHERE o.property_id = p.property_id) as washing_machine,
    (SELECT o.bed FROM Options o WHERE o.property_id = p.property_id) as bed,
    (SELECT o.parking FROM Options o WHERE o.property_id = p.property_id) as parking,
    (SELECT o.near_subway FROM Options o WHERE o.property_id = p.property_id) as near_subway,
    (SELECT o.nearest_subway_station FROM Options o WHERE o.property_id = p.property_id) as nearest_subway_station,
    (SELECT so.cctv FROM SecurityOptions so WHERE so.property_id = p.property_id) as cctv,
    (SELECT so.security_system FROM SecurityOptions so WHERE so.property_id = p.property_id) as security_system,
    (SELECT pr.monthly_rent FROM Prices pr WHERE pr.property_id = p.property_id) as monthly_rent,
    (SELECT pr.deposit FROM Prices pr WHERE pr.property_id = p.property_id) as deposit,
    (SELECT pr.sale_price FROM Prices pr WHERE pr.property_id = p.property_id) as sale_price,
    (SELECT a.supply_area FROM Areas a WHERE a.property_id = p.property_id) as supply_area,
    (SELECT a.exclusive_area FROM Areas a WHERE a.property_id = p.property_id) as exclusive_area
    FROM Properties p
    JOIN Users u ON p.user_id = u.user_id
    JOIN ConstructionCompanies c ON p.construction_company_id = c.construction_company_id
    LEFT JOIN PropertyPhotos pp ON p.property_id = pp.property_id
    WHERE p.property_id = ?
    GROUP BY p.property_id, u.name, c.name
  `;

  connection.query(query, [propertyId], (err, results) => {
    if (err) {
      console.error("Error fetching property details:", err.message);
      res.status(500).send("Error fetching property details");
      return;
    }

    if (results.length === 0) {
      res.status(404).send("Property not found");
      return;
    }

    const property = results[0];
    property.photos = property.photos ? property.photos.split(",") : [];
    property.options = [];
    if (property.refrigerator) property.options.push("refrigerator");
    if (property.tv) property.options.push("tv");
    if (property.air_conditioner) property.options.push("air_conditioner");
    if (property.washing_machine) property.options.push("washing_machine");
    if (property.bed) property.options.push("bed");
    if (property.parking) property.options.push("parking");
    if (property.near_subway) property.options.push("near_subway");
    property.security_options = [];
    if (property.cctv) property.security_options.push("cctv");
    if (property.security_system)
      property.security_options.push("security_system");

    res.render("edit", { property, user, districts, towns });
  });
});

app.post(
  "/property/update/:id",
  isLoggedIn,
  upload.array("photos"),
  (req, res) => {
    const propertyId = req.params.id;
    const {
      name,
      description,
      build_year,
      total_floors,
      floor,
      city,
      district,
      town,
      detail_address,
      construction_company_name,
      options = [],
      nearest_subway_station,
      security_options = [],
      monthly_rent,
      deposit,
      sale_price,
      supply_area,
      exclusive_area,
      property_type,
    } = req.body;

    const updatePropertyQuery = `
    UPDATE Properties
    SET name = ?, description = ?, build_year = ?, total_floors = ?, floor = ?, property_type = ?
    WHERE property_id = ?
  `;

    connection.query(
      updatePropertyQuery,
      [
        name,
        description,
        build_year,
        total_floors,
        floor,
        property_type,
        propertyId,
      ],
      (err) => {
        if (err) {
          console.error("Error updating property:", err.message);
          res.status(500).send("Error updating property: " + err.message);
          return;
        }

        const updateAddressQuery = `
        UPDATE Addresses
        SET city = ?, district = ?, town = ?, detail_address = ?
        WHERE address_id = (SELECT address_id FROM Properties WHERE property_id = ?)
      `;
        connection.query(
          updateAddressQuery,
          [city, district, town, detail_address, propertyId],
          (err) => {
            if (err) {
              console.error("Error updating address:", err.message);
              res.status(500).send("Error updating address: " + err.message);
              return;
            }

            const updateCompanyQuery = `
            UPDATE ConstructionCompanies
            SET name = ?
            WHERE construction_company_id = (SELECT construction_company_id FROM Properties WHERE property_id = ?)
          `;
            connection.query(
              updateCompanyQuery,
              [construction_company_name, propertyId],
              (err) => {
                if (err) {
                  console.error(
                    "Error updating construction company:",
                    err.message
                  );
                  res
                    .status(500)
                    .send(
                      "Error updating construction company: " + err.message
                    );
                  return;
                }

                const updateOptionsQuery = `
                UPDATE Options
                SET refrigerator = ?, tv = ?, air_conditioner = ?, washing_machine = ?, bed = ?, parking = ?, near_subway = ?, nearest_subway_station = ?
                WHERE property_id = ?
              `;
                const optionValues = {
                  refrigerator: options.includes("refrigerator"),
                  tv: options.includes("tv"),
                  air_conditioner: options.includes("air_conditioner"),
                  washing_machine: options.includes("washing_machine"),
                  bed: options.includes("bed"),
                  parking: options.includes("parking"),
                  near_subway: options.includes("near_subway"),
                  nearest_subway_station: nearest_subway_station || "",
                };

                connection.query(
                  updateOptionsQuery,
                  [
                    optionValues.refrigerator,
                    optionValues.tv,
                    optionValues.air_conditioner,
                    optionValues.washing_machine,
                    optionValues.bed,
                    optionValues.parking,
                    optionValues.near_subway,
                    optionValues.nearest_subway_station,
                    propertyId,
                  ],
                  (err) => {
                    if (err) {
                      console.error("Error updating options:", err.message);
                      res
                        .status(500)
                        .send("Error updating options: " + err.message);
                      return;
                    }

                    const updateSecurityOptionsQuery = `
                    UPDATE SecurityOptions
                    SET cctv = ?, security_system = ?
                    WHERE property_id = ?
                  `;
                    const securityValues = {
                      cctv: security_options.includes("cctv"),
                      security_system:
                        security_options.includes("security_system"),
                    };

                    connection.query(
                      updateSecurityOptionsQuery,
                      [
                        securityValues.cctv,
                        securityValues.security_system,
                        propertyId,
                      ],
                      (err) => {
                        if (err) {
                          console.error(
                            "Error updating security options:",
                            err.message
                          );
                          res
                            .status(500)
                            .send(
                              "Error updating security options: " + err.message
                            );
                          return;
                        }

                        const updatePricesQuery = `
                        UPDATE Prices
                        SET monthly_rent = ?, deposit = ?, sale_price = ?
                        WHERE property_id = ?
                      `;
                        const priceValues = {
                          monthly_rent: monthly_rent || null,
                          deposit: deposit || null,
                          sale_price: sale_price || null,
                        };

                        connection.query(
                          updatePricesQuery,
                          [
                            priceValues.monthly_rent,
                            priceValues.deposit,
                            priceValues.sale_price,
                            propertyId,
                          ],
                          (err) => {
                            if (err) {
                              console.error(
                                "Error updating prices:",
                                err.message
                              );
                              res
                                .status(500)
                                .send("Error updating prices: " + err.message);
                              return;
                            }

                            const updateAreasQuery = `
                            UPDATE Areas
                            SET supply_area = ?, exclusive_area = ?, exclusive_ratio = ?
                            WHERE property_id = ?
                          `;
                            const areaValues = {
                              supply_area: supply_area || null,
                              exclusive_area: exclusive_area || null,
                              exclusive_ratio:
                                exclusive_area / supply_area || null,
                            };

                            connection.query(
                              updateAreasQuery,
                              [
                                areaValues.supply_area,
                                areaValues.exclusive_area,
                                areaValues.exclusive_ratio,
                                propertyId,
                              ],
                              (err) => {
                                if (err) {
                                  console.error(
                                    "Error updating areas:",
                                    err.message
                                  );
                                  res
                                    .status(500)
                                    .send(
                                      "Error updating areas: " + err.message
                                    );
                                  return;
                                }

                                // 기존 사진을 삭제하고 새로운 사진을 추가하는 로직
                                if (req.files && req.files.length > 0) {
                                  const deletePhotoQuery = `
                                  DELETE FROM PropertyPhotos
                                  WHERE property_id = ?
                                `;
                                  connection.query(
                                    deletePhotoQuery,
                                    [propertyId],
                                    (err) => {
                                      if (err) {
                                        console.error(
                                          "Error deleting photos:",
                                          err.message
                                        );
                                        res
                                          .status(500)
                                          .send(
                                            "Error deleting photos: " +
                                              err.message
                                          );
                                        return;
                                      }

                                      const insertPhotoQuery = `
                                    INSERT INTO PropertyPhotos (property_id, photo, mime_type)
                                    VALUES (?, ?, ?)
                                  `;
                                      req.files.forEach((file) => {
                                        connection.query(
                                          insertPhotoQuery,
                                          [
                                            propertyId,
                                            file.buffer,
                                            file.mimetype,
                                          ],
                                          (err) => {
                                            if (err) {
                                              console.error(
                                                "Error inserting photo:",
                                                err.message
                                              );
                                            }
                                          }
                                        );
                                      });
                                    }
                                  );
                                }

                                req.flash(
                                  "success",
                                  "매물이 성공적으로 수정되었습니다."
                                );
                                res.redirect("/");
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  }
);

app.listen(port, () => {
  console.log(`server is ready.. http://127.0.0.1:${port}/`);
});
