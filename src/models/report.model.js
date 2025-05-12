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

    // Format dates as 'YYYY-MM-DD' to match Laravel's Carbon format
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

    // Get purchase data - matches Laravel logic
    // First get purchase IDs for the period, then sum related order subtotals
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

    // Get purchase totals from orders table
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

    // Get sale data - matches Laravel logic
    // First get sale IDs for the period, then sum related order subtotals
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

    // Get sale totals from orders table
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
    // Get user role from request (assuming you have authentication middleware)
    // const userRole = req.user.role;

    // Initialize variables
    let companies = [];
    let company_names = [];
    let company_purchases_array = [];
    let company_sales_array = [];

    // Get companies based on user role
    // if (userRole === "user" || userRole === "secretary") {
    //   // For regular users or secretaries, only get their company
    //   const [userCompany] = await db.query(
    //     `SELECT * FROM companies WHERE id = ?`,
    //     [req.user.company_id]
    //   );
    //   companies = userCompany;
    // } else {
    // For admins, get all companies
    const [allCompanies] = await db.query(`SELECT * FROM companies`);
    companies = allCompanies;
    // }

    // Extract company names
    company_names = companies.map((company) => company.name);

    // Process each company
    for (const company of companies) {
      // Initialize purchase and sale queries
      let purchaseQuery = `SELECT id FROM purchases WHERE company_id = ?`;
      let saleQuery = `SELECT id FROM sales WHERE company_id = ?`;
      const purchaseParams = [company.id];
      const saleParams = [company.id];

      // Apply date filters if provided
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

      // Get purchase IDs for the company
      const [companyPurchases] = await db.query(purchaseQuery, purchaseParams);
      const purchaseIds = companyPurchases.map((p) => p.id);

      // Get sale IDs for the company
      const [companySales] = await db.query(saleQuery, saleParams);
      const saleIds = companySales.map((s) => s.id);

      // Calculate purchase total
      let companyPurchasesTotal = 0;
      if (purchaseIds.length > 0) {
        const [purchaseTotal] = await db.query(
          `SELECT SUM(subtotal) as total FROM orders
           WHERE orderable_id IN (?) AND orderable_type = 'App\\\\Models\\\\Purchase'`,
          [purchaseIds]
        );
        companyPurchasesTotal = Number(purchaseTotal[0].total) || 0;
      }

      // Calculate sale total
      let companySalesTotal = 0;
      if (saleIds.length > 0) {
        const [saleTotal] = await db.query(
          `SELECT SUM(subtotal) as total FROM orders
           WHERE orderable_id IN (?) AND orderable_type = 'App\\\\Models\\\\Sale'`,
          [saleIds]
        );
        companySalesTotal = Number(saleTotal[0].total) || 0;
      }

      // Add to results arrays
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
    // Initialize variables
    let store_names = [];
    let store_purchases_array = [];
    let store_sales_array = [];

    // Get stores based on user role
    let storesQuery = "SELECT * FROM stores";
    const whereClauses = [];
    const params = [];

    // if (req.user.role === "user" || req.user.role === "secretary") {
    //   whereClauses.push("company_id = ?");
    //   params.push(req.user.company_id);
    // }

    if (whereClauses.length > 0) {
      storesQuery += " WHERE " + whereClauses.join(" AND ");
    }

    const [stores] = await db.query(storesQuery, params);

    // Extract store names
    store_names = stores.map((store) => store.name);

    // Process each store
    for (const store of stores) {
      // Initialize purchase and sale queries
      let purchaseQuery = "SELECT id FROM purchases WHERE store_id = ?";
      let saleQuery = "SELECT id FROM sales WHERE store_id = ?";
      const purchaseParams = [store.id];
      const saleParams = [store.id];

      // Apply date filters if provided
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

      // Get purchases and sales for the store
      const [storePurchases] = await db.query(purchaseQuery, purchaseParams);
      const [storeSales] = await db.query(saleQuery, saleParams);

      // Calculate totals from orders table
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

      // Add to results arrays
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
    // First, get all products with their images
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

    // Then get images for each product
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

      // Format images with src if path exists
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

      // Calculate quantity exactly like Laravel does
      // Get purchase quantities
      const [purchaseQuantities] = await db.query(
        `SELECT SUM(o.quantity) as total_quantity
        FROM orders o
        JOIN purchases p ON o.orderable_id = p.id
        WHERE o.product_id = ?
        AND o.orderable_type = 'App\\\\Models\\\\Purchase'`,
        [product.id]
      );

      // Get sale quantities
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

      // Set default values for missing fields
      product.barcode_symbology_id = product.barcode_symbology_id || 1;
      product.category_id = product.category_id || 1;
      product.tax_id = product.tax_id || 1;
      product.tax_method = product.tax_method || 0;
      product.supplier_id = product.supplier_id || 1;
      product.image = product.image || null;
      product.detail = product.detail || null;

      // Format dates to ISO string
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

    // Base query
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

    // Add company filter if provided
    if (company_id) {
      query += ` AND pur.company_id = ?`;
      params.push(company_id);
    }

    // Add product filter if provided
    if (product_id) {
      query += ` AND o.product_id = ?`;
      params.push(product_id);
    }

    const [countResult] = await db.query(query, params);
    const total = countResult.length || 0;

    // Add ordering and pagination
    query += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
    const limit = parseInt(per_page);
    const offset = (parseInt(page) - 1) * limit;
    params.push(limit, offset);

    // Execute the query
    const [orders] = await db.query(query, params);

    // Get product IDs to fetch images
    const productIds = orders
      .map((order) => order.product_id)
      .filter((id, index, self) => self.indexOf(id) === index);

    // Fetch images for all products
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

      // Group images by product ID
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
          src: image.path, // Add src field for compatibility
        });
        return acc;
      }, {});
    }

    // Format the response to match Laravel's pagination structure
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

    // Base query for products with all necessary fields
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

    // Add keyword filtering
    const queryParams = [];
    if (keyword) {
      query += ` WHERE p.name LIKE ? OR p.code LIKE ?`;
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    // Always sort by created_at DESC as requested
    query += ` ORDER BY p.created_at DESC`;

    // Handle pagination
    if (per_page) {
      query += ` LIMIT ? OFFSET ?`;
      queryParams.push(parseInt(per_page), offset);
    }

    const [products] = await db.query(query, queryParams);

    // Group images for each product
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

      // Add image if exists
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

    // Calculate purchased/sold quantities and amounts for each product
    for (const product of results) {
      // Base queries with company filter if provided
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

      // Execute queries
      const [purchasedResults, soldResults] = await Promise.all([
        db.query(purchasedQuery, company_id ? companyParams : queryParams),
        db.query(soldQuery, company_id ? companyParams : queryParams),
      ]);

      // Update product with calculated values
      product.purchased_quantity = purchasedResults[0][0]?.quantity || 0;
      product.purchased_amount = purchasedResults[0][0]?.amount || 0;
      product.sold_quantity = soldResults[0][0]?.quantity || 0;
      product.sold_amount = soldResults[0][0]?.amount || 0;
      product.quantity = product.purchased_quantity - product.sold_quantity;
    }

    // For paginated response
    if (per_page) {
      let countQuery = `SELECT COUNT(*) as total FROM products p`;
      const countParams = [];

      if (keyword) {
        countQuery += ` WHERE p.name LIKE ? OR p.code LIKE ?`;
        countParams.push(`%${keyword}%`, `%${keyword}%`);
      }

      const [[{ total }]] = await db.query(countQuery, countParams);
      const totalPages = Math.ceil(total / per_page);

      // Helper function to generate pagination URLs
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

    // For non-paginated response
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
