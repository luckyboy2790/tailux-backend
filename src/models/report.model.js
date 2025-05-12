const db = require("../config/db");

exports.getOverviewChartData = async (req) => {
  try {
    let company_id = 1;

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
    let companies = [];
    let company_names = [];
    let company_purchases_array = [];
    let company_sales_array = [];

    const [allCompanies] = await db.query(`SELECT * FROM companies`);
    companies = allCompanies;

    company_names = companies.map((company) => company.name);

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
    const whereClauses = [];
    const params = [];

    if (whereClauses.length > 0) {
      storesQuery += " WHERE " + whereClauses.join(" AND ");
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
    const [products] = await db.query(
      `SELECT
        p.*,
        NULL as barcode_symbology_id,
        NULL as category_id,
        NULL as tax_id,
        NULL as tax_method,
        NULL as supplier_id,
        NULL as image,
        NULL as detail
      FROM products p
      ORDER BY p.id`
    );

    for (const product of products) {
      const [images] = await db.query(
        `SELECT
          id,
          path,
          imageable_id,
          imageable_type,
          1 as copied,
          created_at,
          updated_at,
          'image' as type
        FROM images
        WHERE imageable_id = ? AND imageable_type = 'App\\\\Models\\\\Product'`,
        [product.id]
      );

      product.images = images.map((img) => {
        const imageData = {
          id: img.id,
          path: img.path,
          imageable_id: img.imageable_id,
          imageable_type: img.imageable_type,
          copied: img.copied,
          created_at: img.created_at,
          updated_at: img.updated_at,
          type: img.type,
        };

        if (img.path) {
          imageData.src = `${
            process.env.APP_URL || "http://127.0.0.1:8000"
          }/storage/${img.path}`;
        }

        return imageData;
      });

      const [purchaseQuantities] = await db.query(
        `SELECT SUM(o.quantity) as total_quantity
        FROM orders o
        JOIN purchases p ON o.orderable_id = p.id
        WHERE o.product_id = ?
        AND o.orderable_type = 'App\\\\Models\\\\Purchase'`,
        [product.id]
      );

      const [saleQuantities] = await db.query(
        `SELECT SUM(o.quantity) as total_quantity
        FROM orders o
        JOIN sales s ON o.orderable_id = s.id
        WHERE o.product_id = ?
        AND o.orderable_type = 'App\\\\Models\\\\Sale'`,
        [product.id]
      );

      const quantityPurchase = purchaseQuantities[0].total_quantity || 0;
      const quantitySale = saleQuantities[0].total_quantity || 0;
      product.quantity = quantityPurchase - quantitySale;

      product.barcode_symbology_id = product.barcode_symbology_id || 1;
      product.category_id = product.category_id || 1;
      product.tax_id = product.tax_id || 1;
      product.tax_method = product.tax_method || 0;
      product.supplier_id = product.supplier_id || 1;
      product.image = product.image || null;
      product.detail = product.detail || null;

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
    const { company_id, product_id, per_page = 15, page = 1 } = req.query;

    let query = `
      SELECT o.*,
             p.name as product_name, p.code as product_code, p.unit as product_unit,
             p.cost as product_cost, p.price as product_price, p.alert_quantity as product_alert_quantity,
             p.image as product_image,
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
        AND o.expiry_date != ''
        AND o.expiry_date <= ?
    `;

    const params = [new Date().toISOString().split("T")[0]];

    if (company_id) {
      query += ` AND pur.company_id = ?`;
      params.push(company_id);
    }

    if (product_id) {
      query += ` AND o.product_id = ?`;
      params.push(product_id);
    }

    const [countResult] = await db.query(query, params);
    const total = countResult.length || 0;

    query += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
    const limit = parseInt(per_page);
    const offset = (parseInt(page) - 1) * limit;
    params.push(limit, offset);

    const [orders] = await db.query(query, params);

    const productIds = orders
      .map((order) => order.product_id)
      .filter((id, index, self) => self.indexOf(id) === index);

    let productImages = {};
    if (productIds.length > 0) {
      const [images] = await db.query(
        `
        SELECT * FROM images
        WHERE imageable_type = 'App\\\\Models\\\\Product'
        AND imageable_id IN (?)
      `,
        [productIds]
      );

      productImages = images.reduce((acc, image) => {
        if (!acc[image.imageable_id]) {
          acc[image.imageable_id] = [];
        }
        acc[image.imageable_id].push({
          id: image.id,
          path: image.path,
          imageable_id: image.imageable_id,
          imageable_type: image.imageable_type,
          created_at: image.created_at,
          updated_at: image.updated_at,
          src: image.path,
        });
        return acc;
      }, {});
    }

    const last_page = Math.ceil(total / limit);
    const from = offset + 1;
    const to = Math.min(offset + limit, total);

    const response = {
      status: "Success",
      data: {
        current_page: parseInt(page),
        data: orders.map((order) => ({
          id: order.id,
          product_id: order.product_id,
          cost: order.cost,
          price: order.price,
          quantity: order.quantity,
          subtotal: order.subtotal,
          expiry_date: order.expiry_date,
          serial_no: order.serial_no,
          orderable_id: order.orderable_id,
          orderable_type: order.orderable_type,
          pre_order_item_id: order.pre_order_item_id,
          created_at: order.created_at,
          updated_at: order.updated_at,
          images: productImages[order.product_id] || [],
          product: {
            id: order.product_id,
            name: order.product_name,
            code: order.product_code,
            unit: order.product_unit,
            cost: order.product_cost,
            price: order.product_price,
            alert_quantity: order.product_alert_quantity,
            image: order.product_image,
            created_at: null,
            updated_at: null,
          },
          orderable: {
            id: order.orderable_id,
            user_id: order.user_id,
            timestamp: order.purchase_timestamp,
            reference_no: order.purchase_reference_no,
            store_id: order.purchase_store_id,
            company_id: order.purchase_company_id,
            supplier_id: order.purchase_supplier_id,
            discount: order.purchase_discount,
            discount_string: order.purchase_discount_string,
            shipping: order.purchase_shipping,
            shipping_string: order.purchase_shipping_string,
            returns: order.purchase_returns,
            grand_total: order.purchase_grand_total,
            credit_days: order.purchase_credit_days,
            expiry_date: order.purchase_expiry_date,
            attachment: order.purchase_attachment,
            note: order.purchase_note,
            status: order.purchase_status,
            order_id: order.purchase_order_id,
            created_at: order.created_at,
            updated_at: order.updated_at,
            total_amount: order.purchase_grand_total,
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
            label: "&laquo; Anterior",
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
            label: "Siguiente &raquo;",
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
        total: total,
      },
      message: null,
    };

    return response;
  } catch (error) {
    console.error(error);
    return {
      status: "Failed",
      data: null,
      message: error.message,
    };
  }
};

exports.getProductsReport = async (req) => {
  try {
    const { keyword = "", per_page, page = 1, company_id } = req.query;
    const offset = per_page ? (page - 1) * per_page : 0;

    let query = `
      SELECT
        p.id, p.name, p.code, p.barcode_symbology_id, p.category_id,
        p.unit, p.cost, p.price, p.tax_id, p.tax_method,
        p.alert_quantity, p.supplier_id, p.image as product_image, p.detail,
        p.created_at, p.updated_at,
        i.id as image_id,
        i.path as image_path,
        i.copied as image_copied,
        i.created_at as image_created_at,
        i.updated_at as image_updated_at
      FROM products p
      LEFT JOIN images i ON i.imageable_id = p.id AND i.imageable_type = 'App\\\\Models\\\\Product'
    `;

    const queryParams = [];
    if (keyword) {
      query += ` WHERE p.name LIKE ? OR p.code LIKE ?`;
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    query += ` ORDER BY p.created_at DESC`;

    if (per_page) {
      query += ` LIMIT ? OFFSET ?`;
      queryParams.push(parseInt(per_page), offset);
    }

    const [products] = await db.query(query, queryParams);

    const resultsMap = new Map();

    products.forEach((product) => {
      if (!resultsMap.has(product.id)) {
        const productData = {
          id: product.id,
          name: product.name,
          code: product.code,
          barcode_symbology_id: product.barcode_symbology_id,
          category_id: product.category_id,
          unit: product.unit,
          cost: product.cost,
          price: product.price,
          tax_id: product.tax_id,
          tax_method: product.tax_method,
          alert_quantity: product.alert_quantity,
          supplier_id: product.supplier_id,
          image: product.product_image,
          detail: product.detail,
          created_at: product.created_at,
          updated_at: product.updated_at,
          purchased_quantity: 0,
          sold_quantity: 0,
          purchased_amount: 0,
          sold_amount: 0,
          quantity: 0,
          images: [],
        };
        resultsMap.set(product.id, productData);
      }

      if (product.image_id) {
        resultsMap.get(product.id).images.push({
          id: product.image_id,
          path: product.image_path,
          imageable_id: product.id,
          imageable_type: "App\\Models\\Product",
          copied: product.image_copied,
          created_at: product.image_created_at,
          updated_at: product.image_updated_at,
          type: "image",
          src: product.image_path
            ? `${req.protocol}://${req.get("host")}/storage/${
                product.image_path
              }`
            : null,
        });
      }
    });

    const results = Array.from(resultsMap.values());

    for (const product of results) {
      let purchasedQuery = `
        SELECT
          COALESCE(SUM(o.quantity), 0) as quantity,
          COALESCE(SUM(o.subtotal), 0) as amount
        FROM orders o
        LEFT JOIN purchases p ON o.orderable_id = p.id
        WHERE o.product_id = ?
        AND o.orderable_type = 'App\\\\Models\\\\Purchase'
      `;

      let soldQuery = `
        SELECT
          COALESCE(SUM(o.quantity), 0) as quantity,
          COALESCE(SUM(o.subtotal), 0) as amount
        FROM orders o
        LEFT JOIN sales s ON o.orderable_id = s.id
        WHERE o.product_id = ?
        AND o.orderable_type = 'App\\Http\\Controllers\\Add'
      `;

      const queryParams = [product.id];
      const companyParams = [product.id, company_id];

      if (company_id) {
        purchasedQuery += ` AND p.company_id = ?`;
        soldQuery += ` AND s.company_id = ?`;
      }

      const [purchasedResults, soldResults] = await Promise.all([
        db.query(purchasedQuery, company_id ? companyParams : queryParams),
        db.query(soldQuery, company_id ? companyParams : queryParams),
      ]);

      product.purchased_quantity = purchasedResults[0][0]?.quantity || 0;
      product.purchased_amount = purchasedResults[0][0]?.amount || 0;
      product.sold_quantity = soldResults[0][0]?.quantity || 0;
      product.sold_amount = soldResults[0][0]?.amount || 0;
      product.quantity = product.purchased_quantity - product.sold_quantity;
    }

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
    throw error;
  }
};

exports.getExpiredPurchasesReport = async (filters) => {
  try {
    const values = [];
    const filterConditions = [];

    const page = parseInt(filters.page) || 1;
    const perPage = parseInt(filters.per_page) || 15;

    const keywordLike = filters.keyword ? `%${filters.keyword}%` : null;

    if (keywordLike) {
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

    filterConditions.push("p.credit_days IS NOT NULL");

    if (filters.company_id) {
      filterConditions.push("p.company_id = ?");
      values.push(filters.company_id);
    }

    if (filters.startDate && filters.endDate) {
      if (filters.startDate === filters.endDate) {
        filterConditions.push("DATE(p.expiry_date) = ?");
        values.push(filters.startDate);
      } else {
        filterConditions.push("p.expiry_date BETWEEN ? AND ?");
        values.push(filters.startDate, filters.endDate);
      }
    } else {
      const from = "1970-01-01";
      const to = new Date().toISOString().split("T")[0];
      filterConditions.push("p.expiry_date BETWEEN ? AND ?");
      values.push(from, to);
    }

    const whereClause = filterConditions.length
      ? `WHERE ${filterConditions.join(" AND ")}`
      : "";

    const baseQuery = `
      SELECT p.*
      FROM purchases p
      ${whereClause}
      ORDER BY p.timestamp DESC
    `;

    const [rows] = await db.query(baseQuery, values);
    const ids = rows.map((r) => r.id);

    if (!ids.length) {
      return {
        status: "Success",
        data: {
          current_page: page,
          data: [],
          first_page_url: null,
          from: 0,
          last_page: 0,
          last_page_url: null,
          links: [],
          next_page_url: null,
          path: null,
          per_page: perPage,
          prev_page_url: null,
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

    const paidMap = {};
    for (const p of paymentRows) paidMap[p.id] = parseFloat(p.paid_amount || 0);

    const unpaid = rows.filter(
      (r) => parseFloat(r.grand_total || 0) > (paidMap[r.id] || 0)
    );
    const total = unpaid.length;
    const lastPage = Math.ceil(total / perPage);
    const offset = (page - 1) * perPage;
    const paginated = unpaid.slice(offset, offset + perPage);

    const companyIds = [...new Set(paginated.map((r) => r.company_id))];
    const storeIds = [...new Set(paginated.map((r) => r.store_id))];
    const supplierIds = [...new Set(paginated.map((r) => r.supplier_id))];
    const userIds = [...new Set(paginated.map((r) => r.user_id))];

    const [companies, stores, suppliers, users, orders] = await Promise.all([
      db.query(
        `SELECT id, name FROM companies WHERE id IN (${companyIds
          .map(() => "?")
          .join(",")})`,
        companyIds
      ),
      db.query(
        `SELECT id, name FROM stores WHERE id IN (${storeIds
          .map(() => "?")
          .join(",")})`,
        storeIds
      ),
      db.query(
        `SELECT * FROM suppliers WHERE id IN (${supplierIds
          .map(() => "?")
          .join(",")})`,
        supplierIds
      ),
      db.query(
        `SELECT * FROM users WHERE id IN (${userIds.map(() => "?").join(",")})`,
        userIds
      ),
      db.query(
        `SELECT * FROM orders WHERE orderable_type = 'App\\\\Models\\\\Purchase' AND orderable_id IN (${ids
          .map(() => "?")
          .join(",")})`,
        ids
      ),
    ]);

    const mapById = (items) => Object.fromEntries(items.map((i) => [i.id, i]));
    const companyMap = mapById(companies[0]);
    const storeMap = mapById(stores[0]);
    const supplierMap = mapById(suppliers[0]);
    const userMap = mapById(users[0]);

    const orderMap = {};
    for (const o of orders[0]) {
      if (!orderMap[o.orderable_id]) orderMap[o.orderable_id] = [];
      orderMap[o.orderable_id].push(o);
    }

    const enriched = paginated.map((row) => {
      const user = userMap[row.user_id] || {};
      const userCompany = user.company_id ? companyMap[user.company_id] : null;

      return {
        ...row,
        paid_amount: paidMap[row.id] || 0,
        total_amount: row.grand_total,
        company: companyMap[row.company_id] || null,
        store: storeMap[row.store_id] || null,
        supplier: supplierMap[row.supplier_id] || null,
        orders: orderMap[row.id] || [],
        images: [],
      };
    });

    const path = "/api/purchase/expired_purchases_report";
    const baseUrl = `${process.env.APP_URL || "http://localhost"}${path}`;

    const links = [
      {
        url:
          page > 1 ? `${baseUrl}?page=${page - 1}&per_page=${perPage}` : null,
        label: "&laquo; Anterior",
        active: false,
      },
      {
        url: `${baseUrl}?page=${page}&per_page=${perPage}`,
        label: page.toString(),
        active: true,
      },
      {
        url:
          page < lastPage
            ? `${baseUrl}?page=${page + 1}&per_page=${perPage}`
            : null,
        label: "Siguiente &raquo;",
        active: false,
      },
    ];

    return {
      status: "Success",
      data: {
        current_page: page,
        data: enriched,
        first_page_url: `${baseUrl}?page=1&per_page=${perPage}`,
        from: offset + 1,
        last_page: lastPage,
        last_page_url: `${baseUrl}?page=${lastPage}&per_page=${perPage}`,
        links,
        next_page_url:
          page < lastPage
            ? `${baseUrl}?page=${page + 1}&per_page=${perPage}`
            : null,
        path: baseUrl,
        per_page: perPage,
        prev_page_url:
          page > 1 ? `${baseUrl}?page=${page - 1}&per_page=${perPage}` : null,
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

    let query = `
      SELECT s.* FROM sales s
      LEFT JOIN companies c ON s.company_id = c.id
      LEFT JOIN stores st ON s.store_id = st.id
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN customers cust ON s.customer_id = cust.id
    `;

    const whereClauses = [];
    const params = [];

    if (
      req.user &&
      (req.user.role === "user" || req.user.role === "secretary")
    ) {
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
      whereClauses.push(`
        (s.reference_no LIKE ? OR
        c.name LIKE ? OR
        st.name LIKE ? OR
        s.timestamp LIKE ?)
      `);
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword);
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

    if (whereClauses.length > 0) {
      query += " WHERE " + whereClauses.join(" AND ");
    }

    query += " ORDER BY s.timestamp DESC";

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as count_table`;
    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0].total;

    const offset = (page - 1) * per_page;
    query += " LIMIT ? OFFSET ?";
    params.push(parseInt(per_page), offset);

    const [sales] = await db.query(query, params);

    for (const sale of sales) {
      const [company] = await db.query("SELECT * FROM companies WHERE id = ?", [
        sale.company_id,
      ]);
      sale.company = company[0] || null;

      const [store] = await db.query("SELECT * FROM stores WHERE id = ?", [
        sale.store_id,
      ]);
      if (store[0]) {
        const [storeCompany] = await db.query(
          "SELECT * FROM companies WHERE id = ?",
          [store[0].company_id]
        );
        store[0].company = storeCompany[0] || null;
      }
      sale.store = store[0] || null;

      const [user] = await db.query("SELECT * FROM users WHERE id = ?", [
        sale.user_id,
      ]);
      sale.user = user[0] || null;

      const [customer] = await db.query(
        "SELECT * FROM customers WHERE id = ?",
        [sale.customer_id]
      );
      sale.customer = customer[0] || null;

      const [orders] = await db.query(
        `
        SELECT o.*, p.id as product_id, p.name as product_name, p.code as product_code,
               p.price as product_price, p.cost as product_cost, p.unit as product_unit
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        WHERE o.orderable_id = ? AND o.orderable_type = 'App\\\\Models\\\\Sale'
      `,
        [sale.id]
      );

      sale.orders = orders.map((order) => {
        const product = {
          id: order.product_id,
          name: order.product_name,
          code: order.product_code,
          price: order.product_price,
          cost: order.product_cost,
          unit: order.product_unit,
        };

        order.product = product;
        return order;
      });

      const [payments] = await db.query(
        `
        SELECT SUM(amount) as paid_amount
        FROM payments
        WHERE paymentable_id = ? AND paymentable_type = 'App\\\\Models\\\\Sale' AND status = 1
      `,
        [sale.id]
      );

      sale.paid_amount = payments[0].paid_amount
        ? parseInt(payments[0].paid_amount)
        : 0;
    }

    const last_page = Math.ceil(total / per_page);
    const path = `${req.protocol}://${req.get("host")}${req.baseUrl}${
      req.path
    }`;

    const pagination = {
      current_page: parseInt(page),
      data: sales,
      first_page_url: `${path}?page=1`,
      from: offset + 1,
      last_page,
      last_page_url: `${path}?page=${last_page}`,
      links: [
        {
          url: page > 1 ? `${path}?page=${parseInt(page) - 1}` : null,
          label: "&laquo; Anterior",
          active: false,
        },
        {
          url: `${path}?page=${page}`,
          label: page.toString(),
          active: true,
        },
        {
          url: page < last_page ? `${path}?page=${parseInt(page) + 1}` : null,
          label: "Siguiente &raquo;",
          active: false,
        },
      ],
      next_page_url:
        page < last_page ? `${path}?page=${parseInt(page) + 1}` : null,
      path,
      per_page: parseInt(per_page),
      prev_page_url: page > 1 ? `${path}?page=${parseInt(page) - 1}` : null,
      to: Math.min(offset + parseInt(per_page), total),
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
      status: "Failed",
      data: null,
      message: error.message,
    };
  }
};

exports.getPurchasesReport = async (req) => {
  try {
    const {
      company_id = "",
      supplier_id = "",
      user_id = "",
      keyword = "",
      startDate = "",
      endDate = "",
      sort_by_date = "desc",
      page = 1,
      per_page = 15,
    } = req.query;

    const offset = (page - 1) * per_page;
    const values = [];
    const filterConditions = ["p.status = 1"];

    if (company_id) {
      filterConditions.push("p.company_id = ?");
      values.push(company_id);
    }

    if (supplier_id) {
      filterConditions.push("p.supplier_id = ?");
      values.push(supplier_id);
    }

    if (user_id) {
      filterConditions.push("p.user_id = ?");
      values.push(user_id);
    }

    if (keyword) {
      const keywordLike = `%${keyword}%`;
      filterConditions.push(`(
        p.reference_no LIKE ? OR
        p.grand_total LIKE ? OR
        p.company_id IN (SELECT id FROM companies WHERE name LIKE ?) OR
        p.store_id IN (SELECT id FROM stores WHERE name LIKE ?) OR
        p.supplier_id IN (SELECT id FROM suppliers WHERE company LIKE ?) OR
        p.timestamp LIKE ?
      )`);
      values.push(
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike
      );
    }

    if (startDate && endDate) {
      if (startDate === endDate) {
        filterConditions.push("DATE(p.timestamp) = ?");
        values.push(startDate);
      } else {
        filterConditions.push("p.timestamp BETWEEN ? AND ?");
        values.push(startDate, endDate);
      }
    }

    const whereClause =
      filterConditions.length > 0
        ? `WHERE ${filterConditions.join(" AND ")}`
        : "";

    const countQuery = `SELECT COUNT(*) AS total FROM purchases p ${whereClause}`;
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;

    const purchaseQuery = `
      SELECT
        p.*,
        c.id AS company_id,
        c.name AS company_name,
        c.created_at AS company_created_at,
        c.updated_at AS company_updated_at,
        s.id AS supplier_id,
        s.name AS supplier_name,
        s.company AS supplier_company,
        s.email AS supplier_email,
        s.phone_number AS supplier_phone,
        s.address AS supplier_address,
        s.city AS supplier_city,
        s.note AS supplier_note,
        s.created_at AS supplier_created_at,
        s.updated_at AS supplier_updated_at,
        st.id AS store_id,
        st.name AS store_name,
        st.company_id AS store_company_id,
        st.created_at AS store_created_at,
        st.updated_at AS store_updated_at,
        u.id AS user_id,
        u.username AS user_username,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.email AS user_email,
        u.phone_number AS user_phone,
        u.role AS user_role,
        u.status AS user_status,
        u.picture AS user_picture
      FROM purchases p
      LEFT JOIN companies c ON c.id = p.company_id
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN stores st ON st.id = p.store_id
      LEFT JOIN users u ON u.id = p.user_id
      ${whereClause}
      ORDER BY p.timestamp ${sort_by_date === "asc" ? "ASC" : "DESC"}
      LIMIT ? OFFSET ?
    `;

    const purchaseValues = [...values, parseInt(per_page), offset];
    const [purchaseRows] = await db.query(purchaseQuery, purchaseValues);
    const purchaseIds = purchaseRows.map((row) => row.id);

    if (purchaseIds.length === 0) {
      return {
        status: "Success",
        data: {
          current_page: parseInt(page),
          data: [],
          first_page_url: "",
          from: 0,
          last_page: 0,
          last_page_url: "",
          links: [],
          next_page_url: null,
          path: "",
          per_page: parseInt(per_page),
          prev_page_url: null,
          to: 0,
          total: 0,
        },
        message: null,
      };
    }

    const [orders] = await db.query(
      `
      SELECT
        o.*,
        o.orderable_id AS purchase_id,
        pr.id AS product_id,
        pr.name AS product_name,
        pr.code AS product_code,
        pr.unit AS product_unit,
        pr.cost AS product_cost,
        pr.price AS product_price,
        pr.alert_quantity AS product_alert_quantity
      FROM orders o
      LEFT JOIN products pr ON pr.id = o.product_id
      WHERE o.orderable_type = 'App\\\\Models\\\\Purchase'
        AND o.orderable_id IN (${purchaseIds.map(() => "?").join(",")})
    `,
      purchaseIds
    );

    const [payments] = await db.query(
      `
      SELECT
        *,
        paymentable_id AS purchase_id
      FROM payments
      WHERE paymentable_type = 'App\\\\Models\\\\Purchase'
        AND paymentable_id IN (${purchaseIds.map(() => "?").join(",")})
    `,
      purchaseIds
    );

    const [preturns] = await db.query(
      `
      SELECT
        *,
        purchase_id
      FROM preturns
      WHERE purchase_id IN (${purchaseIds.map(() => "?").join(",")})
    `,
      purchaseIds
    );

    const [images] = await db.query(
      `
      SELECT
        *,
        imageable_id AS purchase_id,
        CONCAT('http://your-domain.com/storage', path) AS src,
        'image' AS type
      FROM images
      WHERE imageable_type = 'App\\\\Models\\\\Purchase'
        AND imageable_id IN (${purchaseIds.map(() => "?").join(",")})
    `,
      purchaseIds
    );

    const mapById = (items, key = "purchase_id") => {
      const map = {};
      for (const item of items) {
        const id = item[key];
        if (!map[id]) map[id] = [];
        map[id].push(item);
      }
      return map;
    };

    const orderMap = mapById(orders);
    const paymentMap = mapById(payments);
    const returnMap = mapById(preturns);
    const imageMap = mapById(images);

    const enriched = purchaseRows.map((row) => {
      const totalPaid = (paymentMap[row.id] || []).reduce(
        (sum, p) => sum + parseFloat(p.amount),
        0
      );
      const totalReturned = (returnMap[row.id] || []).reduce(
        (sum, r) => sum + parseFloat(r.amount),
        0
      );

      return {
        id: row.id,
        user_id: row.user_id,
        timestamp: row.timestamp,
        reference_no: row.reference_no,
        store_id: row.store_id,
        company_id: row.company_id,
        supplier_id: row.supplier_id,
        discount: row.discount,
        discount_string: row.discount_string,
        shipping: row.shipping,
        shipping_string: row.shipping_string,
        returns: row.returns,
        grand_total: row.grand_total,
        credit_days: row.credit_days,
        expiry_date: row.expiry_date,
        attachment: row.attachment,
        note: row.note,
        status: row.status,
        order_id: row.order_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        total_amount: row.grand_total,
        paid_amount: totalPaid,
        returned_amount: totalReturned,
        company: {
          id: row.company_id,
          name: row.company_name,
          created_at: row.company_created_at,
          updated_at: row.company_updated_at,
        },
        store: {
          id: row.store_id,
          name: row.store_name,
          company_id: row.store_company_id,
          created_at: row.store_created_at,
          updated_at: row.store_updated_at,
          company: {
            id: row.company_id,
            name: row.company_name,
            created_at: row.company_created_at,
            updated_at: row.company_updated_at,
          },
        },
        supplier: {
          id: row.supplier_id,
          name: row.supplier_name,
          company: row.supplier_company,
          email: row.supplier_email,
          phone_number: row.supplier_phone,
          address: row.supplier_address,
          city: row.supplier_city,
          note: row.supplier_note,
          created_at: row.supplier_created_at,
          updated_at: row.supplier_updated_at,
        },
        orders: (orderMap[row.id] || []).map((order) => ({
          id: order.id,
          product_id: order.product_id,
          cost: order.cost,
          price: order.price,
          quantity: order.quantity,
          subtotal: order.subtotal,
          expiry_date: order.expiry_date,
          serial_no: order.serial_no,
          orderable_id: order.orderable_id,
          orderable_type: order.orderable_type,
          pre_order_item_id: order.pre_order_item_id,
          created_at: order.created_at,
          updated_at: order.updated_at,
          product: {
            id: order.product_id,
            name: order.product_name,
            code: order.product_code,
            unit: order.product_unit,
            cost: order.product_cost,
            price: order.product_price,
            alert_quantity: order.product_alert_quantity,
          },
        })),
        payments: paymentMap[row.id] || [],
        preturns: returnMap[row.id] || [],
        images: imageMap[row.id] || [],
      };
    });

    const last_page = Math.ceil(total / per_page);
    const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${
      req.path
    }`;
    const queryParams = new URLSearchParams(req.query);
    queryParams.delete("page");

    const first_page_url = `${baseUrl}?${queryParams.toString()}&page=1`;
    const last_page_url = `${baseUrl}?${queryParams.toString()}&page=${last_page}`;
    const next_page_url =
      page < last_page
        ? `${baseUrl}?${queryParams.toString()}&page=${parseInt(page) + 1}`
        : null;
    const prev_page_url =
      page > 1
        ? `${baseUrl}?${queryParams.toString()}&page=${parseInt(page) - 1}`
        : null;

    const links = [
      {
        url: prev_page_url,
        label: "&laquo; Anterior",
        active: false,
      },
    ];

    for (let i = 1; i <= Math.min(10, last_page); i++) {
      links.push({
        url: `${baseUrl}?${queryParams.toString()}&page=${i}`,
        label: i.toString(),
        active: i === parseInt(page),
      });
    }

    if (last_page > 10) {
      links.push({
        url: null,
        label: "...",
        active: false,
      });
      links.push({
        url: `${baseUrl}?${queryParams.toString()}&page=${last_page - 1}`,
        label: (last_page - 1).toString(),
        active: false,
      });
      links.push({
        url: `${baseUrl}?${queryParams.toString()}&page=${last_page}`,
        label: last_page.toString(),
        active: false,
      });
    }

    links.push({
      url: next_page_url,
      label: "Siguiente &raquo;",
      active: false,
    });

    return {
      status: "Success",
      data: {
        current_page: parseInt(page),
        data: enriched,
        first_page_url,
        from: offset + 1,
        last_page,
        last_page_url,
        links,
        next_page_url,
        path: baseUrl,
        per_page: parseInt(per_page),
        prev_page_url,
        to: Math.min(offset + parseInt(per_page), total),
        total,
      },
      message: null,
    };
  } catch (error) {
    console.error("Error in purchasesReport:", error);
    return {
      status: "Error",
      message: "Failed to fetch purchases report",
      data: null,
    };
  }
};

exports.getPaymentsReport = async (filters) => {
  try {
    const values = [];
    const filterConditions = [];

    let company_id = filters.company_id || "";
    if (company_id !== "") {
      filterConditions.push("p.company_id = ?");
      values.push(company_id);
    }

    if (filters.type === "sale") {
      filterConditions.push("p.paymentable_type = 'App\\\\Models\\\\Sale'");
      if (company_id !== "") {
        filterConditions.push(
          "p.paymentable_id IN (SELECT id FROM sales WHERE company_id = ? AND status = 1)"
        );
        values.push(company_id);
      }
    } else if (filters.type === "purchase") {
      filterConditions.push("p.paymentable_type = 'App\\\\Models\\\\Purchase'");
      if (company_id !== "") {
        filterConditions.push(
          "p.paymentable_id IN (SELECT id FROM purchases WHERE company_id = ? AND status = 1)"
        );
        values.push(company_id);
      }
    }

    if (filters.supplier_id) {
      filterConditions.push(`
        p.paymentable_type = 'App\\\\Models\\\\Purchase' AND
        p.paymentable_id IN (SELECT id FROM purchases WHERE supplier_id = ? AND status = 1)
      `);
      values.push(filters.supplier_id);
    }

    if (filters.customer_id) {
      filterConditions.push(`
        p.paymentable_type = 'App\\\\Models\\\\Sale' AND
        p.paymentable_id IN (SELECT id FROM sales WHERE customer_id = ? AND status = 1)
      `);
      values.push(filters.customer_id);
    }

    if (filters.user_id) {
      filterConditions.push(`
        (p.paymentable_type = 'App\\\\Models\\\\Purchase' AND p.paymentable_id IN (SELECT id FROM purchases WHERE user_id = ? AND status = 1)) OR
        (p.paymentable_type = 'App\\\\Models\\\\Sale' AND p.paymentable_id IN (SELECT id FROM sales WHERE user_id = ? AND status = 1))
      `);
      values.push(filters.user_id, filters.user_id);
    }

    if (filters.reference_no) {
      filterConditions.push("p.reference_no LIKE ?");
      values.push(`%${filters.reference_no}%`);
    }

    if (filters.startDate && filters.endDate) {
      if (filters.startDate === filters.endDate) {
        filterConditions.push("DATE(p.timestamp) = ?");
        values.push(filters.startDate);
      } else {
        filterConditions.push("p.timestamp BETWEEN ? AND ?");
        values.push(filters.startDate, filters.endDate);
      }
    }

    const whereClause = filterConditions.length
      ? `WHERE ${filterConditions.join(" AND ")}`
      : "";

    const perPage = parseInt(filters.per_page) || 15;
    const page = parseInt(filters.page) || 1;
    const offset = (page - 1) * perPage;

    const countQuery = `SELECT COUNT(*) AS total FROM payments p ${whereClause}`;
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;

    const paymentQuery = `
      SELECT
        p.*,
        CASE
          WHEN p.paymentable_type = 'App\\\\Models\\\\Purchase' THEN pur.supplier_id
          WHEN p.paymentable_type = 'App\\\\Models\\\\Sale' THEN s.customer_id
          ELSE NULL
        END AS related_id,
        CASE
          WHEN p.paymentable_type = 'App\\\\Models\\\\Purchase' THEN sup.name
          WHEN p.paymentable_type = 'App\\\\Models\\\\Sale' THEN c.name
          ELSE NULL
        END AS supplier,
        CASE
          WHEN p.paymentable_type = 'App\\\\Models\\\\Purchase' THEN pur.reference_no
          WHEN p.paymentable_type = 'App\\\\Models\\\\Sale' THEN s.reference_no
          ELSE NULL
        END AS paymentable_reference_no,
        CASE
          WHEN p.paymentable_type = 'App\\\\Models\\\\Purchase' THEN pur.grand_total
          WHEN p.paymentable_type = 'App\\\\Models\\\\Sale' THEN s.grand_total
          ELSE NULL
        END AS paymentable_grand_total,
        CASE
          WHEN p.paymentable_type = 'App\\\\Models\\\\Purchase' THEN pur.company_id
          WHEN p.paymentable_type = 'App\\\\Models\\\\Sale' THEN s.company_id
          ELSE NULL
        END AS paymentable_company_id,
        CASE
          WHEN p.paymentable_type = 'App\\\\Models\\\\Purchase' THEN pur.timestamp
          WHEN p.paymentable_type = 'App\\\\Models\\\\Sale' THEN s.timestamp
          ELSE NULL
        END AS paymentable_timestamp,
        CASE
          WHEN p.paymentable_type = 'App\\\\Models\\\\Purchase' THEN pur.credit_days
          WHEN p.paymentable_type = 'App\\\\Models\\\\Sale' THEN NULL
          ELSE NULL
        END AS paymentable_credit_days,
        CASE
          WHEN p.paymentable_type = 'App\\\\Models\\\\Purchase' THEN pur.expiry_date
          WHEN p.paymentable_type = 'App\\\\Models\\\\Sale' THEN NULL
          ELSE NULL
        END AS paymentable_expiry_date
      FROM payments p
      LEFT JOIN purchases pur ON p.paymentable_type = 'App\\\\Models\\\\Purchase' AND p.paymentable_id = pur.id
      LEFT JOIN sales s ON p.paymentable_type = 'App\\\\Models\\\\Sale' AND p.paymentable_id = s.id
      LEFT JOIN suppliers sup ON pur.supplier_id = sup.id
      LEFT JOIN customers c ON s.customer_id = c.id
      ${whereClause}
      ORDER BY p.timestamp ${filters.sort_by_date === "asc" ? "ASC" : "DESC"}
      LIMIT ? OFFSET ?
    `;

    const paymentValues = [...values, perPage, offset];
    const [paymentRows] = await db.query(paymentQuery, paymentValues);

    if (!paymentRows.length) {
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

    const paymentIds = paymentRows.map((p) => p.id);

    const [images] = await db.query(
      `SELECT *, imageable_id AS payment_id,
              CONCAT('http://your-domain.com/storage', path) AS src,
              'image' AS type
       FROM images
       WHERE imageable_type = 'App\\\\Models\\\\Payment'
         AND imageable_id IN (${paymentIds.map(() => "?").join(",")})`,
      paymentIds
    );

    const purchasePaymentIds = paymentRows
      .filter((p) => p.paymentable_type === "App\\Models\\Purchase")
      .map((p) => p.paymentable_id);

    let purchases = [];
    if (purchasePaymentIds.length) {
      const [purchaseRows] = await db.query(
        `SELECT pur.*,
                sup.id AS supplier_id,
                sup.name AS supplier_name,
                sup.company AS supplier_company,
                sup.email AS supplier_email,
                sup.phone_number AS supplier_phone,
                sup.address AS supplier_address,
                sup.city AS supplier_city,
                sup.note AS supplier_note,
                (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE paymentable_type = 'App\\\\Models\\\\Purchase' AND paymentable_id = pur.id) AS paid_amount,
                (SELECT COALESCE(SUM(amount), 0) FROM preturns WHERE purchase_id = pur.id) AS returned_amount
         FROM purchases pur
         LEFT JOIN suppliers sup ON pur.supplier_id = sup.id
         WHERE pur.id IN (${purchasePaymentIds.map(() => "?").join(",")})`,
        purchasePaymentIds
      );
      purchases = purchaseRows;
    }

    const salePaymentIds = paymentRows
      .filter((p) => p.paymentable_type === "App\\Models\\Sale")
      .map((p) => p.paymentable_id);

    let sales = [];
    if (salePaymentIds.length) {
      const [saleRows] = await db.query(
        `SELECT s.*,
                c.id AS customer_id,
                c.name AS customer_name,
                c.company AS customer_company,
                c.email AS customer_email,
                c.phone_number AS customer_phone,
                c.address AS customer_address,
                c.city AS customer_city,
                (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE paymentable_type = 'App\\\\Models\\\\Sale' AND paymentable_id = s.id) AS paid_amount
         FROM sales s
         LEFT JOIN customers c ON s.customer_id = c.id
         WHERE s.id IN (${salePaymentIds.map(() => "?").join(",")})`,
        salePaymentIds
      );
      sales = saleRows;
    }

    const imageMap = {};
    images.forEach((img) => {
      if (!imageMap[img.payment_id]) imageMap[img.payment_id] = [];
      imageMap[img.payment_id].push(img);
    });

    const purchaseMap = {};
    purchases.forEach((p) => {
      purchaseMap[p.id] = p;
    });

    const saleMap = {};
    sales.forEach((s) => {
      saleMap[s.id] = s;
    });

    const enriched = paymentRows.map((payment) => {
      let paymentable = null;
      let supplier = null;

      if (
        payment.paymentable_type === "App\\Models\\Purchase" &&
        purchaseMap[payment.paymentable_id]
      ) {
        const purchase = purchaseMap[payment.paymentable_id];
        paymentable = {
          id: purchase.id,
          user_id: purchase.user_id,
          timestamp: purchase.timestamp,
          reference_no: purchase.reference_no,
          store_id: purchase.store_id,
          company_id: purchase.company_id,
          supplier_id: purchase.supplier_id,
          discount: purchase.discount,
          discount_string: purchase.discount_string,
          shipping: purchase.shipping,
          shipping_string: purchase.shipping_string,
          returns: purchase.returns,
          grand_total: purchase.grand_total,
          credit_days: purchase.credit_days,
          expiry_date: purchase.expiry_date,
          attachment: purchase.attachment,
          note: purchase.note,
          status: purchase.status,
          order_id: purchase.order_id,
          created_at: purchase.created_at,
          updated_at: purchase.updated_at,
          total_amount: purchase.grand_total,
          paid_amount: purchase.paid_amount || 0,
          returned_amount: purchase.returned_amount || 0,
          supplier: {
            id: purchase.supplier_id,
            name: purchase.supplier_name,
            company: purchase.supplier_company,
            email: purchase.supplier_email,
            phone_number: purchase.supplier_phone,
            address: purchase.supplier_address,
            city: purchase.supplier_city,
            note: purchase.supplier_note,
          },
        };
        supplier = purchase.supplier_name;
      } else if (
        payment.paymentable_type === "App\\Models\\Sale" &&
        saleMap[payment.paymentable_id]
      ) {
        const sale = saleMap[payment.paymentable_id];
        paymentable = {
          id: sale.id,
          user_id: sale.user_id,
          timestamp: sale.timestamp,
          reference_no: sale.reference_no,
          store_id: sale.store_id,
          company_id: sale.company_id,
          biller_id: sale.biller_id,
          customer_id: sale.customer_id,
          attachment: sale.attachment,
          note: sale.note,
          status: sale.status,
          discount: sale.discount,
          discount_string: sale.discount_string,
          shipping: sale.shipping,
          shipping_string: sale.shipping_string,
          grand_total: sale.grand_total,
          created_at: sale.created_at,
          updated_at: sale.updated_at,
          total_amount: sale.grand_total,
          paid_amount: sale.paid_amount || 0,
          customer: sale.customer_id
            ? {
                id: sale.customer_id,
                name: sale.customer_name,
                company: sale.customer_company,
                email: sale.customer_email,
                phone_number: sale.customer_phone,
                address: sale.customer_address,
                city: sale.customer_city,
              }
            : null,
        };
        supplier = sale.customer_name;
      }

      return {
        ...payment,
        supplier: supplier || payment.supplier,
        images: imageMap[payment.id] || [],
        paymentable: paymentable,
      };
    });

    const totalPages = Math.ceil(total / perPage);
    const baseUrl = `http://your-domain.com/api/report/payments_report`;

    const links = [
      {
        url: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
        label: "&laquo; Anterior",
        active: false,
      },
    ];

    const maxPagesToShow = 10;
    let startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      links.push({
        url: `${baseUrl}?page=${i}`,
        label: i.toString(),
        active: i === page,
      });
    }

    if (endPage < totalPages - 1) {
      links.push({
        url: null,
        label: "...",
        active: false,
      });
    }

    if (endPage < totalPages) {
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
        links,
        next_page_url: page < totalPages ? `${baseUrl}?page=${page + 1}` : null,
        path: baseUrl,
        per_page: perPage,
        prev_page_url: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
        to: Math.min(page * perPage, total),
        total,
      },
      message: null,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      message: "Failed to fetch payments report",
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

    // Count total records
    const countQuery = `SELECT COUNT(*) AS total FROM customers ${whereClause}`;
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;

    // Get paginated customer data
    const customerQuery = `
      SELECT * FROM customers
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const customerValues = [...values, perPage, offset];
    const [customerRows] = await db.query(customerQuery, customerValues);

    // Get sales data for customers
    const customerIds = customerRows.map((c) => c.id);
    let salesData = [];
    let paymentData = [];

    if (customerIds.length > 0) {
      // Base sales query with status condition
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

      // Add company filter if user has a company
      if (user && user.company_id) {
        salesQuery += ` AND company_id = ?`;
        salesParams.push(user.company_id);
      }

      salesQuery += ` GROUP BY customer_id`;

      [salesData] = await db.query(salesQuery, salesParams);

      // Get payment totals for the filtered sales
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

        // Add company filter if user has a company
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

    // Create maps for quick lookup
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

    // Enrich customer data with sales and payment info
    const enrichedCustomers = customerRows.map((customer) => ({
      ...customer,
      total_sales: salesMap[customer.id]?.total_sales || 0,
      total_amount: salesMap[customer.id]?.total_amount || 0,
      paid_amount: paymentMap[customer.id]?.paid_amount || 0,
    }));

    // Calculate pagination metadata
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
