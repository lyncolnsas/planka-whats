import React, { useEffect, useState, useCallback } from 'react';
import { Tab, Header, Icon, Progress, Segment, Statistic, Button, Loader } from 'semantic-ui-react';
import socket from '../../../api/socket';

const formatBytes = (bytes) => {
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const SystemPane = React.memo(() => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        try {
            const { item } = await socket.get('/system');
            setStats(item);
        } catch (e) {
            console.error('Failed to fetch system stats:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, [fetchStats]);

    if (!stats && loading) {
        return (
            <Tab.Pane>
                <Loader active inline="centered" />
            </Tab.Pane>
        );
    }

    if (!stats) {
        return (
            <Tab.Pane>
                <div style={{ textAlign: 'center', color: '#888' }}>
                    <Icon name="warning sign" size="large" />
                    <p>Não foi possível carregar as estatísticas do servidor da Planka.</p>
                </div>
            </Tab.Pane>
        );
    }

    const { cpu, memory, disk, uptime } = stats;

    const memoryUsed = memory.total - memory.free;
    const memoryPercent = memory.total > 0 ? Math.round((memoryUsed / memory.total) * 100) : 0;

    const diskUsed = disk.total - disk.free;
    const diskPercent = disk.total > 0 ? Math.round((diskUsed / disk.total) * 100) : 0;

    return (
        <Tab.Pane>
            <Header as="h4" dividing>
                <Icon name="server" />
                Sistema / Recursos (Node)
            </Header>

            <Button size="tiny" icon="refresh" content="Atualizar agora" onClick={fetchStats} loading={loading} style={{ marginBottom: 20 }} />

            <Header as="h5">Memória RAM</Header>
            <Progress percent={memoryPercent} indicating size="medium" progress>
                {formatBytes(memoryUsed)} / {formatBytes(memory.total)}
            </Progress>

            {disk.total > 0 && (
                <>
                    <Header as="h5">Armazenamento HD</Header>
                    <Progress percent={diskPercent} color={diskPercent > 85 ? 'red' : 'blue'} size="medium" progress>
                        {formatBytes(diskUsed)} / {formatBytes(disk.total)} (Livre: {formatBytes(disk.free)})
                    </Progress>
                </>
            )}

            <Header as="h5">Processador (CPU)</Header>
            <Segment>
                <div><strong>Modelo:</strong> {cpu.model} ({cpu.cores} Núcleos)</div>
                <div style={{ marginTop: 8 }}><strong>Carga Média (1m, 5m, 15m):</strong> {cpu.load1?.toFixed(2)}, {cpu.load5?.toFixed(2)}, {cpu.load15?.toFixed(2)}</div>
            </Segment>

            <Statistic.Group size="mini" style={{ marginTop: 20 }}>
                <Statistic>
                    <Statistic.Value>{Math.floor(uptime / 3600)}h {Math.floor((uptime % 3600) / 60)}m</Statistic.Value>
                    <Statistic.Label>Uptime Servidor (Segundos)</Statistic.Label>
                </Statistic>
            </Statistic.Group>

        </Tab.Pane>
    );
});

export default SystemPane;
