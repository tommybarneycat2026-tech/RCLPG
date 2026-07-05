import { body, param, query as q } from "express-validator";
import * as salesService from "../services/salesService.js";
import { PRICE_TYPES, PAYMENT_METHODS } from "../utils/constants.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const listSales = [
  q("search").optional().isString(),
  q("page").optional().isInt({ min: 1 }),
  q("limit").optional().isInt({ min: 1, max: 100 }),
  q("todayOnly").optional().isIn(["true", "false"]),
  q("dateFilter").optional().isISO8601(),
  q("customerName").optional().isString(),
  q("productFilter").optional().isString(),
  asyncHandler(async (req, res) => {
    const result = await salesService.listSales({
      search: req.query.search || "",
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
      todayOnly: req.query.todayOnly === "true",
      dateFilter: req.query.dateFilter || "",
      customerName: req.query.customerName || "",
      productFilter: req.query.productFilter || "",
    });
    res.json({ success: true, ...result });
  }),
];

export const createSale = [
  body("productId").notEmpty().withMessage("Product is required"),
  body("quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
  body("unitPrice")
    .isFloat({ min: 0 })
    .withMessage("Unit price must be positive"),
  body("priceType").isIn(PRICE_TYPES).withMessage("Invalid price type"),
  body("paymentMethod")
    .optional()
    .isIn(PAYMENT_METHODS)
    .withMessage("Invalid payment method"),
  body("initialPayment")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Initial payment must be non-negative"),
  // Only required when the selected product is a Filled Tank (exchange
  // sale). Empty Cylinder products are sold directly with no trade-in, so
  // this is validated conditionally inside salesService instead.
  body("lpgTankVariant").optional({ values: "falsy" }).trim().isString(),
  body("customerId").optional().isUUID(),
  body("customerName")
    .if(body("customerId").not().exists())
    .notEmpty()
    .withMessage("Customer name is required"),
  asyncHandler(async (req, res) => {
    const sale = await salesService.createSale({
      customerId: req.body.customerId,
      customerName: req.body.customerName,
      fbName: req.body.fbName,
      phoneNumber: req.body.phoneNumber,
      productId: req.body.productId,
      quantity: req.body.quantity,
      unitPrice: req.body.unitPrice,
      priceType: req.body.priceType,
      paymentMethod: req.body.paymentMethod || "Fully Paid",
      initialPayment: req.body.initialPayment,
      lpgTankVariant: req.body.lpgTankVariant,
    });
    res.status(201).json({ success: true, data: sale });
  }),
];

export const updateSale = [
  param("saleId").isUUID(),
  body("customerName").notEmpty(),
  body("productId").notEmpty(),
  body("quantity").isInt({ min: 1 }),
  body("unitPrice").isFloat({ min: 0 }),
  body("priceType").isIn(PRICE_TYPES),
  body("lpgTankVariant").optional({ values: "falsy" }).trim().isString(),
  asyncHandler(async (req, res) => {
    const sale = await salesService.updateSale(req.params.saleId, {
      customerName: req.body.customerName,
      fbName: req.body.fbName,
      phoneNumber: req.body.phoneNumber,
      productId: req.body.productId,
      quantity: req.body.quantity,
      unitPrice: req.body.unitPrice,
      priceType: req.body.priceType,
      lpgTankVariant: req.body.lpgTankVariant,
    });
    res.json({ success: true, data: sale });
  }),
];

export const deleteSale = [
  param("saleId").isUUID(),
  asyncHandler(async (req, res) => {
    const result = await salesService.deleteSale(req.params.saleId);
    res.json({ success: true, data: result });
  }),
];
