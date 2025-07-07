const db = require("../config/db");

exports.getOverviewChartData = async (req) => {
  try {
    let company_id = 1;

    const authUser = req.user;

    if (authUser.company_id) {
      company_id = authUser.company_id;
    }

    if (req.query.company_id) {
      company_id = req.query.company_id;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const startThisMonth = formatDate(new Date(currentYear, currentMonth, 1));
    const endThisMonth = formatDate(new Date(currentYear, currentMonth + 1, 0));

    const startLastMonth = formatDate(
      new Date(currentYear, currentMonth - 1, 1)
    );
    const endLastMonth = formatDate(new Date(currentYear, currentMonth, 0));

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const data = {
      this_month: {
        month_name: `${monthNames[currentMonth]} ${currentYear}`,
        purchase: 0,
        sale: 0,
      },
      last_month: {
        month_name: `${
          monthNames[currentMonth - 1 >= 0 ? currentMonth - 1 : 11]
        } ${currentMonth - 1 >= 0 ? currentYear : currentYear - 1}`,
        purchase: 0,
        sale: 0,
      },
    };

    const [thisMonthPurchases] = await db.query(
      `SELECT id FROM purchases
       WHERE company_id = ? AND DATE(timestamp) BETWEEN ? AND ?`,
      [company_id, startThisMonth, endThisMonth]
    );

    const [lastMonthPurchases] = await db.query(
      `SELECT id FROM purchases
       WHERE company_id = ? AND DATE(timestamp) BETWEEN ? AND ?`,
      [company_id, startLastMonth, endLastMonth]
    );

    if (thisMonthPurchases.length > 0) {
      const purchaseIds = thisMonthPurchases.map((p) => p.id);
      const [thisMonthPurchaseTotal] = await db.query(
        `SELECT SUM(subtotal) as total FROM orders
         WHERE orderable_id IN (?) AND orderable_type = 'App\\\\Models\\\\Purchase'`,
        [purchaseIds]
      );
      data.this_month.purchase = Number(thisMonthPurchaseTotal[0].total) || 0;
    }

    if (lastMonthPurchases.length > 0) {
      const purchaseIds = lastMonthPurchases.map((p) => p.id);
      const [lastMonthPurchaseTotal] = await db.query(
        `SELECT SUM(subtotal) as total FROM orders
         WHERE orderable_id IN (?) AND orderable_type = 'App\\\\Models\\\\Purchase'`,
        [purchaseIds]
      );
      data.last_month.purchase = Number(lastMonthPurchaseTotal[0].total) || 0;
    }

    const [thisMonthSales] = await db.query(
      `SELECT id FROM sales
       WHERE company_id = ? AND DATE(timestamp) BETWEEN ? AND ?`,
      [company_id, startThisMonth, endThisMonth]
    );

    const [lastMonthSales] = await db.query(
      `SELECT id FROM sales
       WHERE company_id = ? AND DATE(timestamp) BETWEEN ? AND ?`,
      [company_id, startLastMonth, endLastMonth]
    );

    if (thisMonthSales.length > 0) {
      const saleIds = thisMonthSales.map((s) => s.id);
      const [thisMonthSaleTotal] = await db.query(
        `SELECT SUM(subtotal) as total FROM orders
         WHERE orderable_id IN (?) AND orderable_type = 'App\\\\Models\\\\Sale'`,
        [saleIds]
      );
      data.this_month.sale = Number(thisMonthSaleTotal[0].total) || 0;
    }

    if (lastMonthSales.length > 0) {
      const saleIds = lastMonthSales.map((s) => s.id);
      const [lastMonthSaleTotal] = await db.query(
        `SELECT SUM(subtotal) as total FROM orders
         WHERE orderable_id IN (?) AND orderable_type = 'App\\\\Models\\\\Sale'`,
        [saleIds]
      );
      data.last_month.sale = Number(lastMonthSaleTotal[0].total) || 0;
    }

    return {
      status: "Success",
      data: data,
      message: null,
    };
  } catch (error) {
    console.log(error);
    return {
      status: "Failed",
      data: null,
      message: error.message,
    };
  }
};

exports.getCompanyChartData = async (req) => {
  try {
    const user = req.user;

    let companies = [];

    if (user?.role === "user" || user?.role === "secretary") {
      const [[company]] = await db.query(
        `SELECT * FROM companies WHERE id = ?`,
        [user.company_id]
      );
      if (!company) throw new Error("Company not found for the user");
      companies = [company];
    } else {
      const [allCompanies] = await db.query(`SELECT * FROM companies`);
      companies = allCompanies;
    }

    const company_names = companies.map((company) => company.name);
    const company_purchases_array = [];
    const company_sales_array = [];

    for (const company of companies) {
      let purchaseQuery = `SELECT id FROM purchases WHERE company_id = ?`;
      let saleQuery = `SELECT id FROM sales WHERE company_id = ?`;
      const purchaseParams = [company.id];
      const saleParams = [company.id];

      if (req.query.startDate && req.query.endDate) {
        if (req.query.startDate === req.query.endDate) {
          purchaseQuery += ` AND DATE(timestamp) = ?`;
          saleQuery += ` AND DATE(timestamp) = ?`;
          purchaseParams.push(req.query.startDate);
          saleParams.push(req.query.startDate);
        } else {
          purchaseQuery += ` AND timestamp BETWEEN ? AND ?`;
          saleQuery += ` AND timestamp BETWEEN ? AND ?`;
          purchaseParams.push(req.query.startDate, req.query.endDate);
          saleParams.push(req.query.startDate, req.query.endDate);
        }
      }

      const [companyPurchases] = await db.query(purchaseQuery, purchaseParams);
      const purchaseIds = companyPurchases.map((p) => p.id);

      const [companySales] = await db.query(saleQuery, saleParams);
      const saleIds = companySales.map((s) => s.id);

      let companyPurchasesTotal = 0;
      if (purchaseIds.length > 0) {
        const [purchaseTotal] = await db.query(
          `SELECT SUM(subtotal) as total FROM orders
           WHERE orderable_id IN (?) AND orderable_type = 'App\\\\Models\\\\Purchase'`,
          [purchaseIds]
        );
        companyPurchasesTotal = Number(purchaseTotal[0].total) || 0;
      }

      let companySalesTotal = 0;
      if (saleIds.length > 0) {
        const [saleTotal] = await db.query(
          `SELECT SUM(subtotal) as total FROM orders
           WHERE orderable_id IN (?) AND orderable_type = 'App\\\\Models\\\\Sale'`,
          [saleIds]
        );
        companySalesTotal = Number(saleTotal[0].total) || 0;
      }

      company_purchases_array.push(companyPurchasesTotal);
      company_sales_array.push(companySalesTotal);
    }

    return {
      status: "Success",
      data: {
        company_names,
        company_purchases_array,
        company_sales_array,
      },
      message: null,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Failed",
      data: null,
      message: error.message,
    };
  }
};

exports.getStoreChartData = async (req) => {
  try {
    let store_names = [];
    let store_purchases_array = [];
    let store_sales_array = [];

    let storesQuery = "SELECT * FROM stores";
    const params = [];

    if (req.user?.role === "user" || req.user?.role === "secretary") {
      storesQuery += " WHERE company_id = ?";
      params.push(req.user.company_id);
    }

    const [stores] = await db.query(storesQuery, params);

    store_names = stores.map((store) => store.name);

    for (const store of stores) {
      let purchaseQuery = "SELECT id FROM purchases WHERE store_id = ?";
      let saleQuery = "SELECT id FROM sales WHERE store_id = ?";
      const purchaseParams = [store.id];
      const saleParams = [store.id];

      if (req.query.startDate && req.query.endDate) {
        if (req.query.startDate === req.query.endDate) {
          purchaseQuery += " AND DATE(timestamp) = ?";
          saleQuery += " AND DATE(timestamp) = ?";
          purchaseParams.push(req.query.startDate);
          saleParams.push(req.query.startDate);
        } else {
          purchaseQuery += " AND timestamp BETWEEN ? AND ?";
          saleQuery += " AND timestamp BETWEEN ? AND ?";
          purchaseParams.push(req.query.startDate, req.query.endDate);
          saleParams.push(req.query.startDate, req.query.endDate);
        }
      }

      const [storePurchases] = await db.query(purchaseQuery, purchaseParams);
      const [storeSales] = await db.query(saleQuery, saleParams);

      let storePurchasesTotal = 0;
      let storeSalesTotal = 0;

      if (storePurchases.length > 0) {
        const purchaseIds = storePurchases.map((p) => p.id);
        const [purchaseTotal] = await db.query(
          `SELECT SUM(subtotal) as total FROM orders
           WHERE orderable_id IN (?) AND orderable_type = 'App\\\\Models\\\\Purchase'`,
          [purchaseIds]
        );
        storePurchasesTotal = Number(purchaseTotal[0].total) || 0;
      }

      if (storeSales.length > 0) {
        const saleIds = storeSales.map((s) => s.id);
        const [saleTotal] = await db.query(
          `SELECT SUM(subtotal) as total FROM orders
           WHERE orderable_id IN (?) AND orderable_type = 'App\\\\Models\\\\Sale'`,
          [saleIds]
        );
        storeSalesTotal = Number(saleTotal[0].total) || 0;
      }

      store_purchases_array.push(storePurchasesTotal);
      store_sales_array.push(storeSalesTotal);
    }

    return {
      status: "Success",
      data: {
        store_names,
        store_purchases_array,
        store_sales_array,
      },
      message: null,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Failed",
      data: null,
      message: error.message,
    };
  }
};

exports.getProductQuantityAlert = async (req) => {
  try {
    const baseUrl = process.env.APP_URL || "http://127.0.0.1:8000";

    const [products] = await db.query(`
      SELECT
        p.id, p.name, p.code, p.unit, p.cost, p.price, p.alert_quantity,
        p.created_at, p.updated_at
      FROM products p
      ORDER BY p.id
    `);

    for (const product of products) {
      const [images] = await db.query(
        `SELECT
          id, path, imageable_id, imageable_type,
          created_at, updated_at
        FROM images
        WHERE imageable_id = ? AND imageable_type = 'App\\\\Models\\\\Product'`,
        [product.id]
      );

      product.images = images.map((img) => ({
        ...img,
        type: "image",
        copied: 1,
        src: img.path ? `${baseUrl}/storage/${img.path}` : null,
      }));

      const [[{ total_quantity: purchaseQty }]] = await db.query(
        `SELECT SUM(o.quantity) AS total_quantity
         FROM orders o
         WHERE o.product_id = ?
         AND o.orderable_type = 'App\\\\Models\\\\Purchase'`,
        [product.id]
      );

      const [[{ total_quantity: saleQty }]] = await db.query(
        `SELECT SUM(o.quantity) AS total_quantity
         FROM orders o
         WHERE o.product_id = ?
         AND o.orderable_type = 'App\\\\Models\\\\Sale'`,
        [product.id]
      );

      product.quantity = (purchaseQty || 0) - (saleQty || 0);
      product.barcode_symbology_id = 1;
      product.category_id = 1;
      product.tax_id = 1;
      product.tax_method = 0;
      product.supplier_id = 1;
      product.image = null;
      product.detail = null;

      if (product.created_at) {
        product.created_at = new Date(product.created_at).toISOString();
      }
      if (product.updated_at) {
        product.updated_at = new Date(product.updated_at).toISOString();
      }
    }

    return {
      status: "Success",
      data: products,
      message: null,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Failed",
      data: null,
      message: error.message,
    };
  }
};

exports.getProductExpiryAlert = async (req) => {
  try {
    const user = req.user;
    const today = new Date().toISOString().split("T")[0];
    const {
      company_id: queryCompanyId,
      product_id,
      per_page = 15,
      page = 1,
    } = req.query;

    let company_id = queryCompanyId;

    if (user.role === "user" && !queryCompanyId) {
      company_id = user.company_id;
    }

    const params = [today];
    let baseQuery = `
      SELECT o.*,
             p.name as product_name, p.code as product_code, p.unit as product_unit,
             p.cost as product_cost, p.price as product_price, p.alert_quantity as product_alert_quantity,
             pur.timestamp as purchase_timestamp, pur.reference_no as purchase_reference_no,
             pur.store_id as purchase_store_id, pur.company_id as purchase_company_id,
             pur.supplier_id as purchase_supplier_id, pur.discount as purchase_discount,
             pur.discount_string as purchase_discount_string, pur.shipping as purchase_shipping,
             pur.shipping_string as purchase_shipping_string, pur.returns as purchase_returns,
             pur.grand_total as purchase_grand_total, pur.credit_days as purchase_credit_days,
             pur.expiry_date as purchase_expiry_date, pur.attachment as purchase_attachment,
             pur.note as purchase_note, pur.status as purchase_status, pur.order_id as purchase_order_id
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN purchases pur ON o.orderable_id = pur.id AND o.orderable_type = 'App\\\\Models\\\\Purchase'
      WHERE o.orderable_type = 'App\\\\Models\\\\Purchase'
        AND o.expiry_date IS NOT NULL
        AND o.expiry_date <= ?
    `;

    if (company_id) {
      baseQuery += ` AND pur.company_id = ?`;
      params.push(company_id);
    }

    if (product_id) {
      baseQuery += ` AND o.product_id = ?`;
      params.push(product_id);
    }

    const countQuery = baseQuery;
    const [countResult] = await db.query(countQuery, params);
    const total = countResult.length;

    const limit = parseInt(per_page);
    const offset = (parseInt(page) - 1) * limit;

    baseQuery += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
    const finalParams = [...params, limit, offset];
    const [orders] = await db.query(baseQuery, finalParams);

    const productIds = orders.map((o) => o.product_id);
    let productImages = {};

    if (productIds.length) {
      const [images] = await db.query(
        `SELECT * FROM images WHERE imageable_type = 'App\\\\Models\\\\Product' AND imageable_id IN (?)`,
        [productIds]
      );

      productImages = images.reduce((acc, img) => {
        if (!acc[img.imageable_id]) acc[img.imageable_id] = [];
        acc[img.imageable_id].push({
          ...img,
          src: `${process.env.APP_URL || "http://127.0.0.1:8000"}/storage/${
            img.path
          }`,
        });
        return acc;
      }, {});
    }

    const last_page = Math.ceil(total / limit);
    const from = offset + 1;
    const to = Math.min(offset + limit, total);

    return {
      status: "Success",
      data: {
        current_page: parseInt(page),
        data: orders.map((o) => ({
          ...o,
          images: productImages[o.product_id] || [],
          product: {
            id: o.product_id,
            name: o.product_name,
            code: o.product_code,
            unit: o.product_unit,
            cost: o.product_cost,
            price: o.product_price,
            alert_quantity: o.product_alert_quantity,
            image: null,
          },
          orderable: {
            id: o.orderable_id,
            timestamp: o.purchase_timestamp,
            reference_no: o.purchase_reference_no,
            store_id: o.purchase_store_id,
            company_id: o.purchase_company_id,
            supplier_id: o.purchase_supplier_id,
            discount: o.purchase_discount,
            discount_string: o.purchase_discount_string,
            shipping: o.purchase_shipping,
            shipping_string: o.purchase_shipping_string,
            returns: o.purchase_returns,
            grand_total: o.purchase_grand_total,
            credit_days: o.purchase_credit_days,
            expiry_date: o.purchase_expiry_date,
            attachment: o.purchase_attachment,
            note: o.purchase_note,
            status: o.purchase_status,
            order_id: o.purchase_order_id,
            total_amount: o.purchase_grand_total,
            paid_amount: null,
            returned_amount: null,
          },
        })),
        first_page_url: `${req.baseUrl}?page=1`,
        from,
        last_page,
        last_page_url: `${req.baseUrl}?page=${last_page}`,
        links: [
          {
            url: page > 1 ? `${req.baseUrl}?page=${parseInt(page) - 1}` : null,
            label: "&laquo; Previous",
            active: false,
          },
          {
            url: `${req.baseUrl}?page=${page}`,
            label: page.toString(),
            active: true,
          },
          {
            url:
              page < last_page
                ? `${req.baseUrl}?page=${parseInt(page) + 1}`
                : null,
            label: "Next &raquo;",
            active: false,
          },
        ],
        next_page_url:
          page < last_page ? `${req.baseUrl}?page=${parseInt(page) + 1}` : null,
        path: req.baseUrl,
        per_page: limit,
        prev_page_url:
          page > 1 ? `${req.baseUrl}?page=${parseInt(page) - 1}` : null,
        to,
        total,
      },
      message: null,
    };
  } catch (error) {
    console.error(error);
    return { status: "Failed", data: null, message: error.message };
  }
};

exports.getProductsReport = async (req) => {
  try {
    const { keyword = "", per_page, page = 1, company_id } = req.query;
    const offset = per_page ? (page - 1) * per_page : 0;

    let baseQuery = `
      SELECT
        p.id, p.name, p.code, p.barcode_symbology_id, p.category_id,
        p.unit, p.cost, p.price, p.tax_id, p.tax_method,
        p.alert_quantity, p.supplier_id, p.image as product_image, p.detail,
        p.created_at, p.updated_at
      FROM products p
    `;

    const baseParams = [];
    if (keyword) {
      baseQuery += ` WHERE p.name LIKE ? OR p.code LIKE ?`;
      baseParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    baseQuery += ` ORDER BY p.created_at DESC`;

    if (per_page) {
      baseQuery += ` LIMIT ? OFFSET ?`;
      baseParams.push(parseInt(per_page), offset);
    }

    const [products] = await db.query(baseQuery, baseParams);
    const productIds = products.map((p) => p.id);

    const [images] = await db.query(
      `SELECT * FROM images WHERE imageable_type = 'App\\\\Models\\\\Product' AND imageable_id IN (${productIds
        .map(() => `?`)
        .join(",")})`,
      productIds
    );

    const imageMap = {};
    for (const img of images) {
      if (!imageMap[img.imageable_id]) imageMap[img.imageable_id] = [];
      imageMap[img.imageable_id].push({
        id: img.id,
        path: img.path,
        copied: img.copied,
        created_at: img.created_at,
        updated_at: img.updated_at,
        type: "image",
        src: `${req.protocol}://${req.get("host")}/storage/${img.path}`,
      });
    }

    let purchaseMap = {},
      saleMap = {};
    if (productIds.length > 0) {
      let purchaseFilter = `product_id IN (${productIds
        .map(() => `?`)
        .join(",")}) AND orderable_type = 'App\\\\Models\\\\Purchase'`;
      let saleFilter = `product_id IN (${productIds
        .map(() => `?`)
        .join(",")}) AND orderable_type = 'App\\\\Models\\\\Sale'`;

      const purchaseParams = [...productIds];
      const saleParams = [...productIds];

      if (company_id) {
        const [[purchaseIds]] = await db.query(
          `SELECT id FROM purchases WHERE company_id = ?`,
          [company_id]
        );
        const [[saleIds]] = await db.query(
          `SELECT id FROM sales WHERE company_id = ?`,
          [company_id]
        );

        const purIds = purchaseIds.map((p) => p.id);
        const salIds = saleIds.map((s) => s.id);

        if (purIds.length > 0) {
          purchaseFilter += ` AND orderable_id IN (${purIds
            .map(() => `?`)
            .join(",")})`;
          purchaseParams.push(...purIds);
        }

        if (salIds.length > 0) {
          saleFilter += ` AND orderable_id IN (${salIds
            .map(() => `?`)
            .join(",")})`;
          saleParams.push(...salIds);
        }
      }

      const [purchaseAgg] = await db.query(
        `SELECT product_id, SUM(quantity) as quantity, SUM(subtotal) as amount FROM orders WHERE ${purchaseFilter} GROUP BY product_id`,
        purchaseParams
      );

      const [saleAgg] = await db.query(
        `SELECT product_id, SUM(quantity) as quantity, SUM(subtotal) as amount FROM orders WHERE ${saleFilter} GROUP BY product_id`,
        saleParams
      );

      for (const row of purchaseAgg) {
        purchaseMap[row.product_id] = {
          quantity: parseFloat(row.quantity || 0),
          amount: parseFloat(row.amount || 0),
        };
      }
      for (const row of saleAgg) {
        saleMap[row.product_id] = {
          quantity: parseFloat(row.quantity || 0),
          amount: parseFloat(row.amount || 0),
        };
      }
    }

    const results = products.map((product) => {
      const purchased = purchaseMap[product.id] || { quantity: 0, amount: 0 };
      const sold = saleMap[product.id] || { quantity: 0, amount: 0 };
      return {
        ...product,
        image: product.product_image,
        quantity: purchased.quantity - sold.quantity,
        purchased_quantity: purchased.quantity,
        purchased_amount: purchased.amount,
        sold_quantity: sold.quantity,
        sold_amount: sold.amount,
        images: imageMap[product.id] || [],
      };
    });

    if (per_page) {
      let countQuery = `SELECT COUNT(*) as total FROM products p`;
      const countParams = [];
      if (keyword) {
        countQuery += ` WHERE p.name LIKE ? OR p.code LIKE ?`;
        countParams.push(`%${keyword}%`, `%${keyword}%`);
      }
      const [[{ total }]] = await db.query(countQuery, countParams);
      const totalPages = Math.ceil(total / per_page);

      const generateUrl = (pageNum) =>
        `${req.protocol}://${req.get("host")}${req.baseUrl}?page=${pageNum}`;

      return {
        status: "Success",
        data: {
          current_page: parseInt(page),
          data: results,
          first_page_url: generateUrl(1),
          from: offset + 1,
          last_page: totalPages,
          last_page_url: generateUrl(totalPages),
          links: [
            {
              url: page > 1 ? generateUrl(page - 1) : null,
              label: "&laquo; Previous",
              active: false,
            },
            {
              url: generateUrl(page),
              label: page,
              active: true,
            },
            {
              url: page < totalPages ? generateUrl(page + 1) : null,
              label: "Next &raquo;",
              active: false,
            },
          ],
          next_page_url: page < totalPages ? generateUrl(page + 1) : null,
          path: `${req.protocol}://${req.get("host")}${req.baseUrl}`,
          per_page: parseInt(per_page),
          prev_page_url: page > 1 ? generateUrl(page - 1) : null,
          to: Math.min(offset + parseInt(per_page), total),
          total: parseInt(total),
        },
        message: null,
      };
    }

    return {
      status: "Success",
      data: results,
      message: null,
    };
  } catch (error) {
    console.error("Error in products report:", error);
    return {
      status: "Error",
      message: error.message,
      data: null,
    };
  }
};

exports.getExpiredPurchasesReport = async (req) => {
  try {
    const { keyword, company_id: reqCompanyId, startDate, endDate } = req.query;
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 15;
    const offset = (page - 1) * perPage;

    const authUser = req.user;
    const isRestricted =
      authUser.role === "user" || authUser.role === "secretary";
    const effectiveCompanyId =
      reqCompanyId || (isRestricted ? authUser.company_id : null);

    const values = [];
    const filterConditions = ["p.credit_days IS NOT NULL"];

    if (keyword) {
      const keywordLike = `%${keyword}%`;

      const [companies, suppliers, stores] = await Promise.all([
        db.query(`SELECT id FROM companies WHERE name LIKE ?`, [keywordLike]),
        db.query(`SELECT id FROM suppliers WHERE company LIKE ?`, [
          keywordLike,
        ]),
        db.query(`SELECT id FROM stores WHERE name LIKE ?`, [keywordLike]),
      ]);

      const companyIds = companies[0].map((c) => c.id);
      const supplierIds = suppliers[0].map((s) => s.id);
      const storeIds = stores[0].map((s) => s.id);

      filterConditions.push(`(
        p.reference_no LIKE ?
        OR p.timestamp LIKE ?
        OR p.grand_total LIKE ?
        ${companyIds.length ? "OR p.company_id IN (?)" : ""}
        ${supplierIds.length ? "OR p.supplier_id IN (?)" : ""}
        ${storeIds.length ? "OR p.store_id IN (?)" : ""}
      )`);

      values.push(keywordLike, keywordLike, keywordLike);
      if (companyIds.length) values.push(companyIds);
      if (supplierIds.length) values.push(supplierIds);
      if (storeIds.length) values.push(storeIds);
    }

    if (effectiveCompanyId) {
      filterConditions.push("p.company_id = ?");
      values.push(effectiveCompanyId);
    }

    if (startDate && endDate) {
      if (startDate === endDate) {
        filterConditions.push("DATE(p.expiry_date) = ?");
        values.push(startDate);
      } else {
        filterConditions.push("p.expiry_date BETWEEN ? AND ?");
        values.push(startDate, endDate);
      }
    } else {
      filterConditions.push("p.expiry_date BETWEEN ? AND ?");
      values.push("1970-01-01", new Date().toISOString().split("T")[0]);
    }

    const whereClause = filterConditions.length
      ? `WHERE ${filterConditions.join(" AND ")}`
      : "";

    const baseQuery = `SELECT p.* FROM purchases p ${whereClause} ORDER BY p.timestamp DESC`;
    const [rows] = await db.query(baseQuery, values);
    const ids = rows.map((r) => r.id);

    if (!ids.length) {
      return {
        status: "Success",
        data: {
          current_page: page,
          data: [],
          from: 0,
          last_page: 0,
          per_page: perPage,
          to: 0,
          total: 0,
        },
        message: null,
      };
    }

    const [paymentRows] = await db.query(
      `SELECT paymentable_id AS id, SUM(amount) AS paid_amount
       FROM payments
       WHERE paymentable_type = 'App\\\\Models\\\\Purchase' AND paymentable_id IN (${ids
         .map(() => "?")
         .join(",")})
       GROUP BY paymentable_id`,
      ids
    );

    const paidMap = Object.fromEntries(
      paymentRows.map((p) => [p.id, parseFloat(p.paid_amount || 0)])
    );

    const unpaid = rows.filter(
      (r) => parseFloat(r.grand_total || 0) > (paidMap[r.id] || 0)
    );
    const total = unpaid.length;
    const lastPage = Math.ceil(total / perPage);
    const paginated = unpaid.slice(offset, offset + perPage);

    const idsFiltered = paginated.map((r) => r.id);

    const [companies, stores, suppliers, users, orders] = await Promise.all([
      db.query(
        `SELECT id, name FROM companies WHERE id IN (${[
          ...new Set(paginated.map((r) => r.company_id)),
        ]
          .map(() => "?")
          .join(",")})`,
        [...new Set(paginated.map((r) => r.company_id))]
      ),
      db.query(
        `SELECT id, name FROM stores WHERE id IN (${[
          ...new Set(paginated.map((r) => r.store_id)),
        ]
          .map(() => "?")
          .join(",")})`,
        [...new Set(paginated.map((r) => r.store_id))]
      ),
      db.query(
        `SELECT * FROM suppliers WHERE id IN (${[
          ...new Set(paginated.map((r) => r.supplier_id)),
        ]
          .map(() => "?")
          .join(",")})`,
        [...new Set(paginated.map((r) => r.supplier_id))]
      ),
      db.query(
        `SELECT * FROM users WHERE id IN (${[
          ...new Set(paginated.map((r) => r.user_id)),
        ]
          .map(() => "?")
          .join(",")})`,
        [...new Set(paginated.map((r) => r.user_id))]
      ),
      db.query(
        `SELECT * FROM orders WHERE orderable_type = 'App\\\\Models\\\\Purchase' AND orderable_id IN (${idsFiltered
          .map(() => "?")
          .join(",")})`,
        idsFiltered
      ),
    ]);

    const mapById = (rows) => Object.fromEntries(rows.map((i) => [i.id, i]));

    const companyMap = mapById(companies[0]);
    const storeMap = mapById(stores[0]);
    const supplierMap = mapById(suppliers[0]);

    const orderMap = {};
    for (const o of orders[0]) {
      if (!orderMap[o.orderable_id]) orderMap[o.orderable_id] = [];
      orderMap[o.orderable_id].push(o);
    }

    const enriched = paginated.map((row) => ({
      ...row,
      total_amount: row.grand_total,
      paid_amount: paidMap[row.id] || 0,
      company: companyMap[row.company_id] || null,
      store: storeMap[row.store_id] || null,
      supplier: supplierMap[row.supplier_id] || null,
      orders: orderMap[row.id] || [],
      images: [],
    }));

    return {
      status: "Success",
      data: {
        current_page: page,
        data: enriched,
        from: offset + 1,
        last_page: lastPage,
        per_page: perPage,
        to: Math.min(offset + perPage, total),
        total,
      },
      message: null,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      message: "Failed to fetch expired purchases report",
      data: null,
    };
  }
};

exports.getSalesReport = async (req) => {
  try {
    const {
      company_id,
      customer_id,
      user_id,
      keyword,
      startDate,
      endDate,
      per_page = 15,
      page = 1,
    } = req.query;

    const offset = (page - 1) * per_page;
    const whereClauses = [];
    const params = [];

    if (req.user && ["user", "secretary"].includes(req.user.role)) {
      whereClauses.push("s.company_id = ?");
      params.push(req.user.company_id);
    }

    if (company_id) {
      whereClauses.push("s.company_id = ?");
      params.push(company_id);
    }

    if (customer_id) {
      whereClauses.push("s.customer_id = ?");
      params.push(customer_id);
    }

    if (user_id) {
      whereClauses.push("s.user_id = ?");
      params.push(user_id);
    }

    if (keyword) {
      const like = `%${keyword}%`;
      whereClauses.push(`(
        s.reference_no LIKE ? OR
        c.name LIKE ? OR
        st.name LIKE ? OR
        s.timestamp LIKE ?
      )`);
      params.push(like, like, like, like);
    }

    if (startDate && endDate) {
      if (startDate === endDate) {
        whereClauses.push("DATE(s.timestamp) = ?");
        params.push(startDate);
      } else {
        whereClauses.push("s.timestamp BETWEEN ? AND ?");
        params.push(startDate, endDate);
      }
    }

    let query = `
      SELECT s.* FROM sales s
      LEFT JOIN companies c ON s.company_id = c.id
      LEFT JOIN stores st ON s.store_id = st.id
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN customers cust ON s.customer_id = cust.id
    `;

    if (whereClauses.length) {
      query += `WHERE ${whereClauses.join(" AND ")}`;
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as count_sub`;
    const [[{ total }]] = await db.query(countQuery, params);

    query += " ORDER BY s.timestamp DESC LIMIT ? OFFSET ?";
    params.push(parseInt(per_page), offset);

    const [sales] = await db.query(query, params);

    for (const sale of sales) {
      const [company] = await db.query("SELECT * FROM companies WHERE id = ?", [
        sale.company_id,
      ]);
      const [store] = await db.query("SELECT * FROM stores WHERE id = ?", [
        sale.store_id,
      ]);
      const [user] = await db.query("SELECT * FROM users WHERE id = ?", [
        sale.user_id,
      ]);
      const [customer] = await db.query(
        "SELECT * FROM customers WHERE id = ?",
        [sale.customer_id]
      );
      const [orders] = await db.query(
        `SELECT o.*, p.id as product_id, p.name as product_name, p.code as product_code,
                p.price as product_price, p.cost as product_cost, p.unit as product_unit
         FROM orders o
         LEFT JOIN products p ON o.product_id = p.id
         WHERE o.orderable_id = ? AND o.orderable_type = 'App\\\\Models\\\\Sale'`,
        [sale.id]
      );
      const [payments] = await db.query(
        `SELECT SUM(amount) as paid_amount FROM payments
         WHERE paymentable_id = ? AND paymentable_type = 'App\\\\Models\\\\Sale' AND status = 1`,
        [sale.id]
      );

      sale.company = company[0] || null;
      sale.store = store[0] || null;
      sale.user = user[0] || null;
      sale.customer = customer[0] || null;
      sale.orders = orders.map((order) => ({
        ...order,
        product: {
          id: order.product_id,
          name: order.product_name,
          code: order.product_code,
          price: order.product_price,
          cost: order.product_cost,
          unit: order.product_unit,
        },
      }));
      sale.paid_amount = parseInt(payments[0]?.paid_amount || 0);
    }

    const totalPages = Math.ceil(total / per_page);
    const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${
      req.path
    }`;

    return {
      status: "Success",
      data: {
        current_page: parseInt(page),
        data: sales,
        first_page_url: `${baseUrl}?page=1`,
        from: offset + 1,
        last_page: totalPages,
        last_page_url: `${baseUrl}?page=${totalPages}`,
        next_page_url: page < totalPages ? `${baseUrl}?page=${page + 1}` : null,
        path: baseUrl,
        per_page: parseInt(per_page),
        prev_page_url: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
        to: offset + sales.length,
        total,
      },
      message: null,
    };
  } catch (error) {
    console.error("getSalesReport error:", error);
    return { status: "Error", data: null, message: error.message };
  }
};

exports.getPurchasesReport = async (req) => {
  try {
    const {
      company_id,
      supplier_id,
      user_id,
      keyword,
      startDate,
      endDate,
      sort_by_date = "desc",
      per_page = 15,
      page = 1,
    } = req.query;

    const offset = (page - 1) * per_page;
    const filters = ["p.status = 1"];
    const values = [];

    const auth_user = req.user;
    if (auth_user && ["user", "secretary"].includes(auth_user.role)) {
      filters.push("p.company_id = ?");
      values.push(auth_user.company_id);
    }

    if (company_id) {
      filters.push("p.company_id = ?");
      values.push(company_id);
    }
    if (supplier_id) {
      filters.push("p.supplier_id = ?");
      values.push(supplier_id);
    }
    if (user_id) {
      filters.push("p.user_id = ?");
      values.push(user_id);
    }
    if (keyword) {
      const like = `%${keyword}%`;
      filters.push(`(
        p.reference_no LIKE ? OR
        p.grand_total LIKE ? OR
        p.timestamp LIKE ? OR
        p.company_id IN (SELECT id FROM companies WHERE name LIKE ?) OR
        p.store_id IN (SELECT id FROM stores WHERE name LIKE ?) OR
        p.supplier_id IN (SELECT id FROM suppliers WHERE company LIKE ?)
      )`);
      values.push(like, like, like, like, like, like);
    }
    if (startDate && endDate) {
      if (startDate === endDate) {
        filters.push("DATE(p.timestamp) = ?");
        values.push(startDate);
      } else {
        filters.push("p.timestamp BETWEEN ? AND ?");
        values.push(startDate, endDate);
      }
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM purchases p ${where}`,
      values
    );
    const last_page = Math.ceil(total / per_page);

    const query = `
      SELECT p.*, 
             c.name as company_name,
             st.name as store_name,
             s.name as supplier_name,
             s.company as supplier_company
      FROM purchases p
      LEFT JOIN companies c ON p.company_id = c.id
      LEFT JOIN stores st ON p.store_id = st.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      ${where}
      ORDER BY p.timestamp ${sort_by_date.toUpperCase()}
      LIMIT ? OFFSET ?
    `;
    const purchases = await db.query(query, [
      ...values,
      parseInt(per_page),
      offset,
    ]);
    const purchaseIds = purchases[0].map((p) => p.id);

    let orders = [],
      payments = [],
      returns = [],
      images = [];

    if (purchaseIds.length > 0) {
      [orders] = await db.query(
        `SELECT o.*, 
                p.id AS product_id,
                p.name AS product_name,
                p.code AS product_code,
                p.unit AS product_unit,
                p.cost AS product_cost,
                p.price AS product_price,
                p.alert_quantity AS product_alert_quantity,
                p.created_at AS product_created_at,
                p.updated_at AS product_updated_at
         FROM orders o
         LEFT JOIN products p ON o.product_id = p.id
         WHERE o.orderable_type = 'App\\\\Models\\\\Purchase' AND o.orderable_id IN (${purchaseIds
           .map(() => "?")
           .join(",")})`,
        purchaseIds
      );

      [payments] = await db.query(
        `SELECT * FROM payments WHERE paymentable_type = 'App\\\\Models\\\\Purchase' AND paymentable_id IN (${purchaseIds
          .map(() => "?")
          .join(",")})`,
        purchaseIds
      );

      [returns] = await db.query(
        `SELECT * FROM preturns WHERE purchase_id IN (${purchaseIds
          .map(() => "?")
          .join(",")})`,
        purchaseIds
      );

      [images] = await db.query(
        `SELECT *, imageable_id AS purchase_id, CONCAT('${
          req.protocol
        }://${req.get("host")}/storage', path) AS src, 'image' AS type 
         FROM images WHERE imageable_type = 'App\\\\Models\\\\Purchase' AND imageable_id IN (${purchaseIds
           .map(() => "?")
           .join(",")})`,
        purchaseIds
      );
    }

    const groupBy = (arr, key) =>
      arr.reduce((acc, obj) => {
        const id = obj[key];
        if (!acc[id]) acc[id] = [];
        acc[id].push(obj);
        return acc;
      }, {});

    const ordersMap = groupBy(
      orders.map((o) => ({
        ...o,
        product: {
          id: o.product_id,
          name: o.product_name,
          code: o.product_code,
          unit: o.product_unit,
          cost: o.product_cost,
          price: o.product_price,
          alert_quantity: o.product_alert_quantity,
          created_at: o.product_created_at,
          updated_at: o.product_updated_at,
        },
      })),
      "orderable_id"
    );
    const paymentsMap = groupBy(payments, "paymentable_id");
    const returnsMap = groupBy(returns, "purchase_id");
    const imagesMap = groupBy(images, "purchase_id");

    const enriched = purchases[0].map((p) => {
      const paid = (paymentsMap[p.id] || []).reduce(
        (sum, p) => sum + parseFloat(p.amount),
        0
      );
      const returned = (returnsMap[p.id] || []).reduce(
        (sum, r) => sum + parseFloat(r.amount),
        0
      );

      return {
        ...p,
        total_amount: p.grand_total - returned,
        paid_amount: paid,
        returned_amount: returned,
        company: {
          id: p.company_id,
          name: p.company_name,
        },
        store: {
          id: p.store_id,
          name: p.store_name,
        },
        supplier: {
          id: p.supplier_id,
          name: p.supplier_name,
          company: p.supplier_company,
        },
        orders: ordersMap[p.id] || [],
        payments: paymentsMap[p.id] || [],
        preturns: returnsMap[p.id] || [],
        images: imagesMap[p.id] || [],
      };
    });

    const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}`;
    return {
      status: "Success",
      data: {
        current_page: parseInt(page),
        data: enriched,
        from: offset + 1,
        to: Math.min(offset + parseInt(per_page), total),
        last_page,
        total,
        path: baseUrl,
        per_page: parseInt(per_page),
        prev_page_url: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
        next_page_url: page < last_page ? `${baseUrl}?page=${page + 1}` : null,
      },
      message: null,
    };
  } catch (e) {
    console.error("Error in getPurchasesReport:", e);
    return {
      status: "Error",
      message: e.message,
      data: null,
    };
  }
};

exports.getPaymentsReport = async (req) => {
  try {
    const {
      company_id,
      customer_id,
      supplier_id,
      user_id,
      reference_no,
      type,
      startDate,
      endDate,
      per_page = 15,
      page = 1,
      sort_by_date = "desc",
    } = req.query;

    const filters = [];
    const values = [];
    const auth_user = req.user;

    if (auth_user && ["user", "secretary"].includes(auth_user.role)) {
      filters.push(
        `((p.paymentable_type = 'App\\\\Models\\\\Sale' AND s.company_id = ?) OR (p.paymentable_type = 'App\\\\Models\\\\Purchase' AND pu.company_id = ?))`
      );
      values.push(auth_user.company_id, auth_user.company_id);
    }
    if (company_id) {
      filters.push(
        `((p.paymentable_type = 'App\\\\Models\\\\Sale' AND s.company_id = ?) OR (p.paymentable_type = 'App\\\\Models\\\\Purchase' AND pu.company_id = ?))`
      );
      values.push(company_id, company_id);
    }

    if (type === "sale") {
      filters.push("p.paymentable_type = 'App\\\\Models\\\\Sale'");
    } else if (type === "purchase") {
      filters.push("p.paymentable_type = 'App\\\\Models\\\\Purchase'");
    }

    if (supplier_id) {
      filters.push("pu.supplier_id = ? AND pu.status = 1");
      values.push(supplier_id);
    }

    if (customer_id) {
      filters.push("s.customer_id = ? AND s.status = 1");
      values.push(customer_id);
    }

    if (user_id) {
      filters.push(
        `((p.paymentable_type = 'App\\\\Models\\\\Purchase' AND pu.user_id = ? AND pu.status = 1) OR (p.paymentable_type = 'App\\\\Models\\\\Sale' AND s.user_id = ? AND s.status = 1))`
      );
      values.push(user_id, user_id);
    }

    if (reference_no) {
      filters.push("p.reference_no LIKE ?");
      values.push(`%${reference_no}%`);
    }

    if (startDate && endDate) {
      if (startDate === endDate) {
        filters.push("DATE(p.timestamp) = ?");
        values.push(startDate);
      } else {
        filters.push("p.timestamp BETWEEN ? AND ?");
        values.push(startDate, endDate);
      }
    }

    const offset = (page - 1) * per_page;
    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM payments p
       LEFT JOIN sales s ON p.paymentable_type = 'App\\\\Models\\\\Sale' AND p.paymentable_id = s.id
       LEFT JOIN purchases pu ON p.paymentable_type = 'App\\\\Models\\\\Purchase' AND p.paymentable_id = pu.id
       ${whereClause}`,
      values
    );

    const [payments] = await db.query(
      `SELECT p.*
       FROM payments p
       LEFT JOIN sales s ON p.paymentable_type = 'App\\\\Models\\\\Sale' AND p.paymentable_id = s.id
       LEFT JOIN purchases pu ON p.paymentable_type = 'App\\\\Models\\\\Purchase' AND p.paymentable_id = pu.id
       ${whereClause}
       ORDER BY p.timestamp ${sort_by_date === "asc" ? "ASC" : "DESC"}
       LIMIT ? OFFSET ?`,
      [...values, parseInt(per_page), offset]
    );

    if (!payments.length) {
      const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}`;
      return {
        status: "Success",
        data: {
          current_page: parseInt(page),
          data: [],
          from: 0,
          to: 0,
          last_page: 0,
          total: 0,
          path: baseUrl,
          per_page: parseInt(per_page),
          prev_page_url: null,
          next_page_url: null,
        },
        message: null,
      };
    }

    const paymentableIds = payments.map((p) => p.paymentable_id);
    const typeMap = new Map();
    payments.forEach((p) => typeMap.set(p.id, p.paymentable_type));

    const purchases = await db.query(
      `SELECT pu.*, s.id AS supplier_id, s.name AS supplier_name, s.company AS supplier_company
       FROM purchases pu
       LEFT JOIN suppliers s ON pu.supplier_id = s.id
       WHERE pu.id IN (${paymentableIds.map(() => "?").join(",")})`,
      paymentableIds
    );

    const sales = await db.query(
      `SELECT sa.*, c.id AS customer_id, c.name AS customer_name, c.company AS customer_company
       FROM sales sa
       LEFT JOIN customers c ON sa.customer_id = c.id
       WHERE sa.id IN (${paymentableIds.map(() => "?").join(",")})`,
      paymentableIds
    );

    const [images] = await db.query(
      `SELECT *, imageable_id AS payment_id, CONCAT('${
        req.protocol
      }://${req.get("host")}/storage', path) AS src
       FROM images
       WHERE imageable_type = 'App\\\\Models\\\\Payment' AND imageable_id IN (${payments
         .map(() => "?")
         .join(",")})`,
      payments.map((p) => p.id)
    );

    const enrichPayment = (p) => {
      const type = typeMap.get(p.id);
      const base = {
        ...p,
        images: images.filter((img) => img.payment_id === p.id),
      };

      if (type === "App\\Models\\Purchase") {
        const purchase = purchases[0].find((r) => r.id === p.paymentable_id);
        return {
          ...base,
          supplier: purchase?.supplier_company || "",
          paymentable: purchase || null,
        };
      } else if (type === "App\\Models\\Sale") {
        const sale = sales[0].find((r) => r.id === p.paymentable_id);
        return {
          ...base,
          supplier: sale?.customer_company || "",
          paymentable: sale || null,
        };
      } else {
        return base;
      }
    };

    const enriched = payments.map(enrichPayment);
    const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}`;

    return {
      status: "Success",
      data: {
        current_page: parseInt(page),
        data: enriched,
        from: offset + 1,
        to: Math.min(offset + parseInt(per_page), total),
        last_page: Math.ceil(total / per_page),
        total,
        path: baseUrl,
        per_page: parseInt(per_page),
        prev_page_url: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
        next_page_url:
          page < Math.ceil(total / per_page)
            ? `${baseUrl}?page=${page + 1}`
            : null,
      },
      message: null,
    };
  } catch (e) {
    console.error("Error in getPaymentsReport:", e);
    return {
      status: "Error",
      message: e.message,
      data: null,
    };
  }
};

exports.getCustomersReport = async (filters, user = null) => {
  try {
    const values = [];
    const filterConditions = [];

    if (filters.keyword) {
      const keyword = filters.keyword;
      filterConditions.push(`(
        name LIKE ?
        OR company LIKE ?
        OR phone_number LIKE ?
        OR city LIKE ?
        OR address LIKE ?
      )`);
      const keywordLike = `%${keyword}%`;
      values.push(
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike
      );
    }

    const whereClause = filterConditions.length
      ? `WHERE ${filterConditions.join(" AND ")}`
      : "";

    const perPage = parseInt(filters.per_page) || 15;
    const page = parseInt(filters.page) || 1;
    const offset = (page - 1) * perPage;

    const countQuery = `SELECT COUNT(*) AS total FROM customers ${whereClause}`;
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;

    const customerQuery = `
      SELECT * FROM customers
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const customerValues = [...values, perPage, offset];
    const [customerRows] = await db.query(customerQuery, customerValues);

    const customerIds = customerRows.map((c) => c.id);
    let salesData = [];
    let paymentData = [];

    if (customerIds.length > 0) {
      let salesQuery = `
        SELECT
          customer_id,
          COUNT(*) as total_sales,
          SUM(grand_total) as total_amount,
          GROUP_CONCAT(id) as sale_ids
        FROM sales
        WHERE customer_id IN (${customerIds.map(() => "?").join(",")})
        AND status = 1
      `;

      let salesParams = [...customerIds];

      if (user && user.company_id) {
        salesQuery += ` AND company_id = ?`;
        salesParams.push(user.company_id);
      }

      salesQuery += ` GROUP BY customer_id`;

      [salesData] = await db.query(salesQuery, salesParams);

      if (salesData.length > 0) {
        const saleIds = salesData.flatMap((s) => s.sale_ids.split(","));

        let paymentQuery = `
          SELECT
            s.customer_id,
            SUM(p.amount) as paid_amount
          FROM payments p
          JOIN sales s ON s.id = p.paymentable_id AND p.paymentable_type = 'App\\\\Models\\\\Sale'
          WHERE p.paymentable_id IN (${saleIds.map(() => "?").join(",")})
        `;

        let paymentParams = [...saleIds];

        if (user && user.company_id) {
          paymentQuery += `
            AND p.paymentable_id IN (
              SELECT id FROM sales WHERE company_id = ?
            )
          `;
          paymentParams.push(user.company_id);
        }

        paymentQuery += ` GROUP BY s.customer_id`;

        [paymentData] = await db.query(paymentQuery, paymentParams);
      }
    }

    const salesMap = salesData.reduce((acc, curr) => {
      acc[curr.customer_id] = {
        total_sales: curr.total_sales || 0,
        total_amount: curr.total_amount ? parseInt(curr.total_amount) : 0,
      };
      return acc;
    }, {});

    const paymentMap = paymentData.reduce((acc, curr) => {
      acc[curr.customer_id] = {
        paid_amount: curr.paid_amount ? parseInt(curr.paid_amount) : 0,
      };
      return acc;
    }, {});

    const enrichedCustomers = customerRows.map((customer) => ({
      ...customer,
      total_sales: salesMap[customer.id]?.total_sales || 0,
      total_amount: salesMap[customer.id]?.total_amount || 0,
      paid_amount: paymentMap[customer.id]?.paid_amount || 0,
    }));

    const totalPages = Math.ceil(total / perPage);
    const baseUrl = `${process.env.APP_URL}/api/report/customers_report`;

    const response = {
      status: "Success",
      data: {
        current_page: page,
        data: enrichedCustomers,
        first_page_url: `${baseUrl}?page=1`,
        from: offset + 1,
        last_page: totalPages,
        last_page_url: `${baseUrl}?page=${totalPages}`,
        links: [
          {
            url: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
            label: "&laquo; Anterior",
            active: false,
          },
          {
            url: `${baseUrl}?page=${page}`,
            label: page.toString(),
            active: true,
          },
          {
            url: page < totalPages ? `${baseUrl}?page=${page + 1}` : null,
            label: "Siguiente &raquo;",
            active: false,
          },
        ],
        next_page_url: page < totalPages ? `${baseUrl}?page=${page + 1}` : null,
        path: baseUrl,
        per_page: perPage,
        prev_page_url: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
        to: Math.min(offset + perPage, total),
        total: total,
      },
      message: null,
    };

    return response;
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      message: "Failed to fetch customers report",
      data: null,
    };
  }
};

exports.getSuppliersReport = async (req) => {
  try {
    const values = [];
    const filterConditions = [];

    // Keyword search
    if (req.query.keyword) {
      filterConditions.push(`(
        name LIKE ?
        OR company LIKE ?
        OR email LIKE ?
        OR phone_number LIKE ?
        OR address LIKE ?
        OR city LIKE ?
      )`);
      const keywordLike = `%${req.query.keyword}%`;
      values.push(
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike
      );
    }

    const whereClause = filterConditions.length
      ? `WHERE ${filterConditions.join(" AND ")}`
      : "";

    // Pagination
    const perPage = parseInt(req.query.per_page) || 15;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * perPage;

    // Count query
    const countQuery = `SELECT COUNT(*) AS total FROM suppliers ${whereClause}`;
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;

    // Main query
    const supplierQuery = `
      SELECT * FROM suppliers
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const supplierValues = [...values, perPage, offset];
    const [supplierRows] = await db.query(supplierQuery, supplierValues);
    const supplierIds = supplierRows.map((r) => r.id);

    if (!supplierIds.length) {
      return {
        status: "Success",
        data: {
          current_page: page,
          per_page: perPage,
          total,
          total_pages: Math.ceil(total / perPage),
          data: [],
        },
        message: null,
      };
    }

    // Get purchase stats for each supplier
    const [purchaseStats] = await db.query(
      `
      SELECT
        supplier_id,
        COUNT(*) AS total_purchases,
        SUM(CASE WHEN status = 1 THEN grand_total ELSE 0 END) AS total_amount
      FROM purchases
      WHERE supplier_id IN (${supplierIds.map(() => "?").join(",")})
      GROUP BY supplier_id
    `,
      supplierIds
    );

    // Get payment stats for each supplier
    const [paymentStats] = await db.query(
      `
      SELECT
        p.supplier_id,
        SUM(py.amount) AS paid_amount
      FROM purchases p
      JOIN payments py ON py.paymentable_id = p.id AND py.paymentable_type = 'App\\\\Models\\\\Purchase'
      WHERE p.supplier_id IN (${supplierIds.map(() => "?").join(",")})
        AND p.status = 1
      GROUP BY p.supplier_id
    `,
      supplierIds
    );

    // Get return stats for each supplier
    const [returnStats] = await db.query(
      `
      SELECT
        p.supplier_id,
        SUM(pr.amount) AS returned_amount
      FROM purchases p
      JOIN preturns pr ON pr.purchase_id = p.id
      WHERE p.supplier_id IN (${supplierIds.map(() => "?").join(",")})
        AND p.status = 1
        AND pr.status = 1
      GROUP BY p.supplier_id
    `,
      supplierIds
    );

    // Create maps for quick lookup
    const purchaseMap = {};
    purchaseStats.forEach((stat) => {
      purchaseMap[stat.supplier_id] = {
        total_purchases: stat.total_purchases,
        total_amount: stat.total_amount || 0,
      };
    });

    const paymentMap = {};
    paymentStats.forEach((stat) => {
      paymentMap[stat.supplier_id] = {
        paid_amount: stat.paid_amount || 0,
      };
    });

    const returnMap = {};
    returnStats.forEach((stat) => {
      returnMap[stat.supplier_id] = {
        returned_amount: stat.returned_amount || 0,
      };
    });

    // Enrich supplier data with stats
    const enriched = supplierRows.map((supplier) => {
      const purchaseData = purchaseMap[supplier.id] || {
        total_purchases: 0,
        total_amount: 0,
      };
      const paymentData = paymentMap[supplier.id] || { paid_amount: 0 };
      const returnData = returnMap[supplier.id] || { returned_amount: 0 };

      // Calculate final total amount (subtracting returns)
      const finalTotalAmount =
        purchaseData.total_amount - returnData.returned_amount;

      return {
        ...supplier,
        total_purchases: purchaseData.total_purchases,
        total_amount: finalTotalAmount,
        paid_amount: paymentData.paid_amount,
        created_at: supplier.created_at.toISOString(),
        updated_at: supplier.updated_at.toISOString(),
      };
    });

    // Generate pagination links
    const totalPages = Math.ceil(total / perPage);
    const baseUrl = `${process.env.APP_URL}/api/supplier/search`;

    const links = [];
    links.push({
      url: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
      label: "&laquo; Anterior",
      active: false,
    });

    // Add page links (simplified version - you may want to implement more complex pagination)
    for (let i = 1; i <= Math.min(10, totalPages); i++) {
      links.push({
        url: `${baseUrl}?page=${i}`,
        label: i.toString(),
        active: i === page,
      });
    }

    if (totalPages > 10) {
      links.push({
        url: null,
        label: "...",
        active: false,
      });
      links.push({
        url: `${baseUrl}?page=${totalPages - 1}`,
        label: (totalPages - 1).toString(),
        active: false,
      });
      links.push({
        url: `${baseUrl}?page=${totalPages}`,
        label: totalPages.toString(),
        active: false,
      });
    }

    links.push({
      url: page < totalPages ? `${baseUrl}?page=${page + 1}` : null,
      label: "Siguiente &raquo;",
      active: false,
    });

    return {
      status: "Success",
      data: {
        current_page: page,
        data: enriched,
        first_page_url: `${baseUrl}?page=1`,
        from: (page - 1) * perPage + 1,
        last_page: totalPages,
        last_page_url: `${baseUrl}?page=${totalPages}`,
        links: links,
        next_page_url: page < totalPages ? `${baseUrl}?page=${page + 1}` : null,
        path: baseUrl,
        per_page: perPage,
        prev_page_url: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
        to: Math.min(page * perPage, total),
        total: total,
      },
      message: null,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      message: "Failed to fetch suppliers",
      data: null,
    };
  }
};

exports.getUsersReport = async (filters, authUser) => {
  try {
    const values = [];
    const filterConditions = [];

    // Auth-based role restriction
    if (authUser.role === "user") {
      filterConditions.push("u.company_id = ?");
      values.push(authUser.company_id);
    }

    if (filters.company_id) {
      filterConditions.push("u.company_id LIKE ?");
      values.push(`%${filters.company_id}%`);
    }

    if (filters.keyword) {
      const keyword = `%${filters.keyword}%`;
      filterConditions.push(`(
        u.username LIKE ? OR
        u.first_name LIKE ? OR
        u.last_name LIKE ? OR
        u.email LIKE ? OR
        u.phone_number LIKE ?
      )`);
      values.push(keyword, keyword, keyword, keyword, keyword);
    }

    const whereClause = filterConditions.length
      ? `WHERE ${filterConditions.join(" AND ")}`
      : "";

    const perPage = parseInt(filters.per_page, 10) || 15;
    const page = parseInt(filters.page, 10) || 1;
    const offset = (page - 1) * perPage;

    const countQuery = `SELECT COUNT(*) AS total FROM users u ${whereClause}`;
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;

    const usersQuery = `
      SELECT
        u.*,
        c.id AS company_id,
        c.name AS company_name,
        c.created_at AS company_created_at,
        c.updated_at AS company_updated_at,
        (
          SELECT id FROM stores WHERE company_id = u.company_id LIMIT 1
        ) AS first_store_id
      FROM users u
      LEFT JOIN companies c ON c.id = u.company_id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const userValues = [...values, perPage, offset];
    const [users] = await db.query(usersQuery, userValues);

    const enrichedUsers = users.map((user) => {
      const name =
        [user.first_name, user.last_name].filter(Boolean).join(" ") ||
        user.username;

      return {
        ...user,
        name,
        company: user.company_id
          ? {
              id: user.company_id,
              name: user.company_name,
              created_at: user.company_created_at,
              updated_at: user.company_updated_at,
            }
          : null,
      };
    });

    const totalPages = Math.ceil(total / perPage);
    const baseUrl = `${process.env.APP_URL}/api/report/users_report`;

    const pagination = {
      current_page: page,
      data: enrichedUsers,
      first_page_url: `${baseUrl}?page=1`,
      from: offset + 1,
      last_page: totalPages,
      last_page_url: `${baseUrl}?page=${totalPages}`,
      links: generatePaginationLinks(page, totalPages, baseUrl),
      next_page_url: page < totalPages ? `${baseUrl}?page=${page + 1}` : null,
      path: baseUrl,
      per_page: perPage,
      prev_page_url: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
      to: Math.min(offset + perPage, total),
      total,
    };

    return {
      status: "Success",
      data: pagination,
      message: null,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      message: "Failed to fetch users report",
      data: null,
    };
  }
};

function generatePaginationLinks(currentPage, totalPages, baseUrl) {
  const links = [];

  links.push({
    url: currentPage > 1 ? `${baseUrl}?page=${currentPage - 1}` : null,
    label: "&laquo; Anterior",
    active: false,
  });

  if (totalPages > 0) {
    links.push({
      url: `${baseUrl}?page=1`,
      label: "1",
      active: currentPage === 1,
    });
  }

  let startPage = Math.max(2, currentPage - 2);
  let endPage = Math.min(totalPages - 1, currentPage + 2);

  if (startPage > 2) {
    links.push({
      url: null,
      label: "...",
      active: false,
    });
  }

  for (let i = startPage; i <= endPage; i++) {
    links.push({
      url: `${baseUrl}?page=${i}`,
      label: i.toString(),
      active: i === currentPage,
    });
  }

  if (endPage < totalPages - 1) {
    links.push({
      url: null,
      label: "...",
      active: false,
    });
  }

  if (totalPages > 1) {
    links.push({
      url: `${baseUrl}?page=${totalPages}`,
      label: totalPages.toString(),
      active: currentPage === totalPages,
    });
  }

  links.push({
    url: currentPage < totalPages ? `${baseUrl}?page=${currentPage + 1}` : null,
    label: "Siguiente &raquo;",
    active: false,
  });

  return links;
}
