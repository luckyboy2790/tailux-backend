const db = require("../config/db");

exports.getNotifications = async (req) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(req.user.role);

    let notificationCountQuery = `SELECT COUNT(*) AS count FROM notifications`;
    let notificationsQuery = `SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5`;
    let purchaseNotificationsQuery = `SELECT * FROM notifications WHERE notifiable_type = 'App\\\\Models\\\\Purchase' ORDER BY created_at DESC LIMIT 5`;
    let paymentNotificationsQuery = `SELECT * FROM notifications WHERE notifiable_type = 'App\\\\Models\\\\Payment' ORDER BY created_at DESC LIMIT 5`;

    if (userRole === "user" || userRole === "secretary") {
      const companyIdQuery = `SELECT company_id FROM users WHERE id = ${userId}`;
      const [companyResult] = await db.query(companyIdQuery);
      const companyId = companyResult[0].company_id;

      notificationCountQuery = `SELECT COUNT(*) AS count FROM notifications WHERE company_id = ${companyId}`;
      notificationsQuery = `SELECT * FROM notifications WHERE company_id = ${companyId} ORDER BY created_at DESC LIMIT 5`;
      purchaseNotificationsQuery = `SELECT * FROM notifications WHERE company_id = ${companyId} AND notifiable_type = 'App\\\\Models\\\\Purchase' ORDER BY created_at DESC LIMIT 5`;
      paymentNotificationsQuery = `SELECT * FROM notifications WHERE company_id = ${companyId} AND notifiable_type = 'App\\\\Models\\\\Payment' ORDER BY created_at DESC LIMIT 5`;
    }

    const [[countResult]] = await db.query(notificationCountQuery);
    const notificationCount = countResult.count;

    const [notificationsRows] = await db.query(notificationsQuery);

    const [purchaseNotificationsRows] = await db.query(
      purchaseNotificationsQuery
    );

    const [paymentNotificationsRows] = await db.query(
      paymentNotificationsQuery
    );

    const notifications = notificationsRows.map((r) => ({
      id: r.id,
      message: r.message,
      reference_no: r.reference_no,
      supplier: r.supplier,
      created_at: r.created_at,
      updated_at: r.updated_at,
      user: {
        id: r.user_id,
        name: r.user_name,
      },
      company: {
        id: r.company_id,
        name: r.company_name,
      },
    }));

    const purchaseNotifications = purchaseNotificationsRows.map((r) => ({
      id: r.id,
      message: r.message,
      reference_no: r.reference_no,
      supplier: r.supplier,
      created_at: r.created_at,
      updated_at: r.updated_at,
      user: {
        id: r.user_id,
        name: r.user_name,
      },
      company: {
        id: r.company_id,
        name: r.company_name,
      },
    }));

    const paymentNotifications = paymentNotificationsRows.map((r) => ({
      id: r.id,
      message: r.message,
      reference_no: r.reference_no,
      supplier: r.supplier,
      created_at: r.created_at,
      updated_at: r.updated_at,
      user: {
        id: r.user_id,
        name: r.user_name,
      },
      company: {
        id: r.company_id,
        name: r.company_name,
      },
    }));

    return {
      status: "Success",
      data: {
        notification_count: notificationCount,
        notifications,
        purchase_notifications: purchaseNotifications,
        payment_notifications: paymentNotifications,
      },
      message: null,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      message: "Failed to fetch notifications",
      data: null,
    };
  }
};

exports.searchNotifications = async (req) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const keyword = req.query.keyword;
    const perPage = parseInt(req.query.per_page) || 10;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * perPage;

    let modQuery = `
      SELECT notifications.*, companies.name AS company_name, companies.id AS company_id
      FROM notifications
      JOIN companies ON notifications.company_id = companies.id
    `;
    let countQuery = `
      SELECT COUNT(*) AS count
      FROM notifications
      JOIN companies ON notifications.company_id = companies.id
    `;
    let permissionCondition = "";

    if (userRole === "user" || userRole === "secretary") {
      const companyQuery = `SELECT company_id FROM users WHERE id = ?`;
      const [companyResult] = await db.query(companyQuery, [userId]);

      if (!companyResult.length) {
        return {
          status: "Error",
          message: "User company not found",
          data: null,
        };
      }

      const companyId = companyResult[0].company_id;
      permissionCondition = `WHERE notifications.company_id = ${companyId}`;
      modQuery = modQuery + ` ${permissionCondition}`;
      countQuery = countQuery + ` ${permissionCondition}`;
    }

    if (keyword) {
      const companyIds = await db.query(
        `SELECT id FROM companies WHERE name LIKE ?`,
        [`%${keyword}%`]
      );

      const companyArray = companyIds.map((company) => company.id);

      modQuery = `
        ${modQuery}
        WHERE (notifications.message LIKE ? OR notifications.reference_no LIKE ? OR notifications.supplier LIKE ?
        OR notifications.company_id IN (?))
        ORDER BY notifications.created_at DESC
        LIMIT ? OFFSET ?;
      `;
      countQuery = `
        ${countQuery}
        AND (notifications.message LIKE ? OR notifications.reference_no LIKE ? OR notifications.supplier LIKE ?
        OR notifications.company_id IN (?));
      `;

      const queryParams = [
        `%${keyword}%`,
        `%${keyword}%`,
        `%${keyword}%`,
        companyArray,
        perPage,
        offset,
      ];

      const [dataResult] = await db.query(modQuery, queryParams);
      const [countResult] = await db.query(countQuery, [
        `%${keyword}%`,
        `%${keyword}%`,
        `%${keyword}%`,
        companyArray,
      ]);

      return {
        status: "Success",
        data: {
          notification_count: countResult[0].count,
          notifications: dataResult,
          page,
          per_page: perPage,
        },
        message: null,
      };
    } else {
      const [dataResult] = await db.query(
        modQuery + ` ORDER BY notifications.created_at DESC LIMIT ? OFFSET ?`,
        [perPage, offset]
      );
      const [countResult] = await db.query(countQuery);

      return {
        status: "Success",
        data: {
          notification_count: countResult[0].count,
          notifications: dataResult,
          page,
          per_page: perPage,
        },
        message: null,
      };
    }
  } catch (error) {
    console.error("[notification.search] error:", error);
    return {
      status: "Error",
      message: "Failed to search notifications",
      data: null,
    };
  }
};

exports.deleteNotification = async (req) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const notificationId = req.params.id;

    let permissionCondition = "";

    if (userRole === "user" || userRole === "secretary") {
      const companyIdQuery = `SELECT company_id FROM users WHERE id = ?`;
      const [companyResult] = await db.query(companyIdQuery, [userId]);

      if (!companyResult.length) {
        return {
          status: "Error",
          message: "User company not found",
          data: null,
        };
      }

      const companyId = companyResult[0].company_id;
      permissionCondition = `AND company_id = ${companyId}`;
    }

    const deleteQuery = `
      DELETE FROM notifications 
      WHERE id = ? ${permissionCondition}
    `;

    const [result] = await db.query(deleteQuery, [notificationId]);

    if (result.affectedRows === 0) {
      return {
        status: "Error",
        message: "Notification not found or unauthorized",
        data: null,
      };
    }

    return {
      status: "Success",
      message: "Notification deleted successfully",
      data: { id: notificationId },
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      message: "Failed to delete notification",
      data: null,
    };
  }
};

exports.deleteAllNotifications = async (req) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;

    if (userRole === "admin") {
      const deleteQuery = `DELETE FROM notifications WHERE id IS NOT NULL`;
      await db.query(deleteQuery);
    } else {
      const companyQuery = `SELECT company_id FROM users WHERE id = ?`;
      const [companyResult] = await db.query(companyQuery, [userId]);

      if (!companyResult.length) {
        return {
          status: "Error",
          message: "User company not found",
          data: null,
        };
      }

      const companyId = companyResult[0].company_id;
      const deleteQuery = `DELETE FROM notifications WHERE company_id = ?`;
      await db.query(deleteQuery, [companyId]);
    }

    return {
      status: "Success",
      message: "Notifications deleted successfully",
      data: null,
    };
  } catch (error) {
    console.error("[notification.deleteAll] error:", error);
    return {
      status: "Error",
      message: "Failed to delete notifications",
      data: null,
    };
  }
};
