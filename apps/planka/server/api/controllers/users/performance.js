module.exports = {
    friendlyName: 'Get Users Performance',

    description: 'Returns an aggregation of task performance for each user, including total tasks, pending tasks, and completed tasks based on Board/List status.',

    exits: {
        success: {
            responseType: 'ok',
        },
    },

    async fn() {
        try {
            // 1. Get all active users using Planka's native query method to avoid Waterline surprises
            const users = await User.qm.getAll({ isDeactivated: false });

            const SQL = `
              SELECT 
                u.id AS "userId",
                COUNT(c.id) AS "totalTasks",
                SUM(CASE WHEN l.name ILIKE '%Concluído%' THEN 1 ELSE 0 END) AS "completedTasks"
              FROM user_account u
              LEFT JOIN card_membership cm ON u.id = cm.user_id
              LEFT JOIN card c ON cm.card_id = c.id
              LEFT JOIN list l ON c.list_id = l.id
              WHERE u.is_deactivated = false
              GROUP BY u.id
            `;

            const rawResult = await sails.sendNativeQuery(SQL);
            const stats = rawResult.rows || [];

            // Associate stats with users
            const performanceData = users.map(user => {
                const stat = stats.find(s => s.userId === user.id);
                return {
                    id: user.id,
                    name: user.name,
                    username: user.username,
                    email: user.email,
                    avatarUrl: user.avatar ? user.avatar.url : null,
                    totalTasks: stat ? parseInt(stat.totalTasks, 10) : 0,
                    completedTasks: stat ? parseInt(stat.completedTasks, 10) : 0,
                    pendingTasks: stat ? (parseInt(stat.totalTasks, 10) - parseInt(stat.completedTasks, 10)) : 0,
                };
            });

            return { items: performanceData };
        } catch (e) {
            sails.log.error('Failed to get performance stats API:', e);
            // Even if something fails, return an empty array so UI doesn't crash completely,
            // or return the error message for debugging
            return { items: [], errorTrace: e.message || String(e) };
        }
    }
};
