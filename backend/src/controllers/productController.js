import { body, param, query as q } from "express-validator";
import * as productService from "../services/productService.js";
import { PRODUCT_STATUSES, WEIGHT_CLASSES } from "../utils/constants.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { isAdministratorRole } from "../utils/roles.js";

export const listProducts = [
  q("search").optional().isString(),
  q("brand").optional({ values: "falsy" }).isString(),
  q("condition").optional({ values: "falsy" }).isIn(["filled", "empty"]),
  q("stockTier").optional({ values: "falsy" }).isIn(["out", "low", "good"]),
  q("includeArchived").optional().isIn(["true", "false"]),
  asyncHandler(async (req, res) => {
    const products = await productService.listProducts({
      search: req.query.search || "",
      brand: req.query.brand || "",
      condition: req.query.condition || "",
      stockTier: req.query.stockTier || "",
      includeArchived: req.query.includeArchived === "true",
    });

    // Initial (acquisition) price is sensitive cost data — only admins may
    // view it. Staff receive every other product field unchanged.
    const isAdmin = isAdministratorRole(req.admin?.role);
    const data = isAdmin
      ? products
      : products.map(({ initial_price, ...rest }) => rest);

    res.json({ success: true, data });
  }),
];

export const createProduct = [
  body("brand").trim().notEmpty().withMessage("Brand is required"),
  body("weightClass")
    .custom((value) => WEIGHT_CLASSES.includes(Number(value)))
    .withMessage("Invalid weight class"),
  body("status").isIn(PRODUCT_STATUSES).withMessage("Invalid status"),
  body("stockQuantity")
    .isInt({ min: 0 })
    .withMessage("Stock must be 0 or greater"),
  body("regularRetail")
    .isFloat({ min: 0 })
    .withMessage("Regular retail must be positive"),
  body("wholesalePrice")
    .isFloat({ min: 0 })
    .withMessage("Wholesale price must be positive"),
  body("initialPrice")
    .isFloat({ min: 0 })
    .withMessage("Initial price must be positive"),
  asyncHandler(async (req, res) => {
    const product = await productService.createProduct({
      brand: req.body.brand,
      weightClass: req.body.weightClass,
      status: req.body.status,
      stockQuantity: req.body.stockQuantity,
      regularRetail: req.body.regularRetail,
      wholesalePrice: req.body.wholesalePrice,
      initialPrice: req.body.initialPrice,
    });
    res.status(201).json({ success: true, data: product });
  }),
];

export const updateProduct = [
  param("productId").notEmpty(),
  body("brand").optional().trim().notEmpty(),
  body("weightClass")
    .optional()
    .custom((value) => WEIGHT_CLASSES.includes(Number(value))),
  body("status").optional().isIn(PRODUCT_STATUSES),
  body("stockQuantity").optional().isInt({ min: 0 }),
  body("regularRetail").optional().isFloat({ min: 0 }),
  body("wholesalePrice").optional().isFloat({ min: 0 }),
  body("initialPrice").optional().isFloat({ min: 0 }),
  asyncHandler(async (req, res) => {
    const product = await productService.updateProduct(req.params.productId, {
      brand: req.body.brand,
      weightClass: req.body.weightClass,
      status: req.body.status,
      stockQuantity: req.body.stockQuantity,
      regularRetail: req.body.regularRetail,
      wholesalePrice: req.body.wholesalePrice,
      initialPrice: req.body.initialPrice,
    });
    res.json({ success: true, data: product });
  }),
];

export const archiveProduct = [
  param("productId").notEmpty(),
  asyncHandler(async (req, res) => {
    const product = await productService.archiveProduct(req.params.productId);
    res.json({ success: true, data: product });
  }),
];

export const deleteProduct = [
  param("productId").notEmpty(),
  asyncHandler(async (req, res) => {
    const product = await productService.deleteProduct(req.params.productId);
    res.json({ success: true, data: product });
  }),
];

export const weeklySummary = asyncHandler(async (_req, res) => {
  const data = await productService.getWeeklyStockSummary();
  res.json({ success: true, data });
});

export const brandOverview = asyncHandler(async (_req, res) => {
  const data = await productService.getBrandInventoryOverview();
  res.json({ success: true, data });
});

export const lowStock = asyncHandler(async (_req, res) => {
  const data = await productService.getLowStockProducts();
  res.json({ success: true, data });
});
