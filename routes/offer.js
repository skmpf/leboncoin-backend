const express = require("express");
const router = express.Router();

const formidableMiddleware = require("express-formidable");
const server = express();
server.use(formidableMiddleware);

const Offer = require("../models/Offer");
const isAuthenticated = require("../middleware/isAuthenticated");

const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: "process.env.CLOUD_NAME",
  api_key: "process.env.CLOUDINARY_API_KEY",
  api_secret: "process.env.CLOUDINARY_API_SECRET"
});

// CREATE
router.post("/offer/publish", isAuthenticated, async (req, res) => {
  try {
    cloudinary.uploader.upload(req.file.path, (error, result) => {
      if (error) {
        return res.json({ error: `Upload Error` });
      } else {
        return res.json(result);
      }
    });

    console.log(res.json(result));

    const newPost = await new Offer({
      title: req.fields.title,
      description: req.fields.description,
      price: req.fields.price,
      // pictures: req.files,
      created: new Date(),
      creator: req.user.populate("account")
    });

    if (req.fields.description.length > 500) {
      return res
        .status(400)
        .json({ message: "Description must be 500 characters or less" });
    }
    if (req.fields.title.length > 50) {
      return res
        .status(400)
        .json({ error: "Title must be 50 characters or less" });
    }
    if (req.fields.price > 100000) {
      return res.status(400).json({ error: "Price must be 100 000 or less" });
    } else {
      res.json({
        _id: newPost._id,
        title: newPost.title,
        price: newPost.price,
        created: newPost.created,
        creator: {
          account: { username: newPost.creator.account.username },
          _id: newPost.creator.id
        }
      });
      await newPost.save();
    }
  } catch (error) {
    res.json(error.message);
  }
});

// READ
const createFilters = req => {
  const filters = {};
  if (req.query.priceMin) {
    filters.price = {};
    filters.price.$gte = req.query.priceMin;
  }
  if (req.query.priceMax) {
    if (!filters.price) {
      filters.price = {};
    }
    filters.price.$lte = req.query.priceMax;
  }
  if (req.query.title) {
    filters.title = new RegExp(req.query.title, "i");
  }
  return filters;
};

router.get("/offer/with-count", async (req, res) => {
  try {
    const filters = createFilters(req);
    const search = Offer.find(filters);

    if (req.query.sort === "price-asc") {
      search.sort({ price: 1 });
    } else if (req.query.sort === "price-desc") {
      search.sort({ price: -1 });
    } else if (req.query.sort === "date-desc") {
      search.sort({ date: -1 });
    } else if (req.query.sort === "date-asc") {
      search.sort({ date: 1 });
    }

    if (req.query.page) {
      const page = req.query.page;
      const limit = 3;

      search.limit(limit).skip(limit * (page - 1));
    }

    const products = await search;
    res.json(products);
  } catch (error) {
    res.json(error.message);
  }
});

router.get("/offer/:_id", async (req, res) => {
  try {
    const find = await Offer.findById(req.params._id).populate("creator");
    const product = {
      _id: find._id,
      title: find.title,
      description: find.description,
      price: find.price,
      creator: {
        account: {
          username: find.creator.account.username,
          phone: find.creator.account.phone
        },
        _id: find.creator.id
      },
      created: find.created
    };
    res.json(product);
  } catch (error) {
    res.json(error.message);
  }
});

module.exports = router;
