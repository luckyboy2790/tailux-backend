const db = require("../config/db");

exports.search = async (req) => {
  try {
    const { keyword = "", per_page, page = 1 } = req.query;
    const offset = per_page ? (page - 1) * per_page : 0;

    // Base query with explicit field selection for better performance
    let query = `
      SELECT
        p.id, p.name, p.code, p.barcode_symbology_id, p.category_id,
        p.unit, p.cost, p.price, p.tax_id, p.tax_method,
        p.alert_quantity, p.supplier_id, p.image, p.detail,
        p.created_at, p.updated_at,
        (SELECT COALESCE(SUM(quantity), 0) FROM store_products WHERE product_id = p.id) AS quantity,
        i.id as image_id,
        i.path as image_path,
        i.copied as image_copied,
        i.created_at as image_created_at,
        i.updated_at as image_updated_at
      FROM products p
      LEFT JOIN images i ON i.imageable_id = p.id AND i.imageable_type = 'App\\\\Models\\\\Product'
    `;

    // Add keyword filtering
    if (keyword) {
      query += ` WHERE p.name LIKE ? OR p.code LIKE ?`;
    }

    // Always sort by created_at DESC as requested
    query += ` ORDER BY p.created_at DESC`;

    // Handle pagination
    if (per_page) {
      query += ` LIMIT ? OFFSET ?`;
    }

    // Execute query with parameterized values for security
    const queryParams = keyword ? [`%${keyword}%`, `%${keyword}%`] : [];
    if (per_page) {
      queryParams.push(parseInt(per_page), offset);
    }

    const [products] = await db.query(query, queryParams);

    // Group images for each product more efficiently
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
          image: product.image,
          detail: product.detail,
          created_at: product.created_at,
          updated_at: product.updated_at,
          quantity: product.quantity,
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
          src: product.image_path ? `${product.image_path}` : null,
        });
      }
    });

    const results = Array.from(resultsMap.values());

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
    console.error("Error in product search:", error);
    throw error;
  }
};
