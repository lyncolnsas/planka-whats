const os = require('os');
const fs = require('fs/promises');

module.exports = {
    friendlyName: 'Show System Stats',
    description: 'Show System Stats',

    exits: {
        success: {
            outputType: 'ref',
        },
    },

    fn: async function (inputs, exits) {
        let totalDisk = 0;
        let freeDisk = 0;
        try {
            const stats = await fs.statfs('/');
            totalDisk = stats.blocks * stats.bsize;
            freeDisk = stats.bfree * stats.bsize;
        } catch (err) {
            // Ignorar fallback nativo
        }

        return exits.success({
            item: {
                id: 'system',
                cpu: {
                    cores: os.cpus().length,
                    model: os.cpus()[0].model,
                    load1: os.loadavg()[0],
                    load5: os.loadavg()[1],
                    load15: os.loadavg()[2],
                },
                memory: {
                    total: os.totalmem(),
                    free: os.freemem(),
                },
                disk: {
                    total: totalDisk,
                    free: freeDisk,
                },
                uptime: os.uptime(),
            }
        });
    }
};
