import React, { useEffect, useState, useCallback } from 'react';
import { Header, Icon, Progress, Segment, Loader, Grid, Statistic } from 'semantic-ui-react';
import socket from '../../../api/socket';
import UserAvatar from '../../users/UserAvatar';

import styles from './Home.module.scss';

const PerformanceDashboard = React.memo(() => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        try {
            const result = await socket.get('/performance');
            setStats(result.items || []);
            if (result.errorTrace) {
                console.error("Backend errorTrace:", result.errorTrace);
                setStats([{ id: 'error', name: "API Error", username: result.errorTrace, totalTasks: 0, completedTasks: 0, pendingTasks: 0 }]);
            }
        } catch (e) {
            console.error('Failed to fetch performance stats:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 10000); // 10s auto update
        return () => clearInterval(interval);
    }, [fetchStats]);

    if (!stats && loading) {
        return (
            <div style={{ padding: '20px 0' }}>
                <Loader active inline="centered" />
            </div>
        );
    }

    if (!stats || stats.length === 0) {
        return (
            <div style={{ marginBottom: '30px', background: '#f4f5f7', padding: '20px', borderRadius: '8px' }}>
                <Header as="h3" style={{ color: '#172b4d' }}>
                    <Icon name="chart line" color="blue" />
                    <Header.Content>Desempenho da Equipe</Header.Content>
                </Header>
                <div style={{ color: '#8c98a8', padding: '10px 0' }}>
                    {loading ? "Carregando métricas..." : "Dashboard está ativado, mas ocorreu um erro na busca dos dados ou nenhum usuário foi encontrado."}
                </div>
            </div>
        );
    }

    return (
        <div style={{ marginBottom: '30px', background: '#f4f5f7', padding: '20px', borderRadius: '8px' }}>
            <Header as="h3" style={{ color: '#172b4d' }}>
                <Icon name="chart line" color="blue" />
                <Header.Content>Desempenho da Equipe</Header.Content>
            </Header>

            <Grid stackable columns={Math.min(stats.length, 4)}>
                {stats.map((user) => {
                    const total = user.totalTasks;
                    const completed = user.completedTasks;
                    const pending = user.pendingTasks;
                    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

                    return (
                        <Grid.Column key={user.id}>
                            <Segment>
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                                    <UserAvatar id={user.id} size="large" />
                                    <div style={{ marginLeft: '10px' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1em' }} title={user.name}>{user.name}</div>
                                        <div style={{ color: '#5e6c84', fontSize: '0.9em' }}>@{user.username}</div>
                                    </div>
                                </div>

                                <Statistic.Group size="mini" widths="two" style={{ marginBottom: '10px' }}>
                                    <Statistic>
                                        <Statistic.Value>{completed}</Statistic.Value>
                                        <Statistic.Label>Concluídas</Statistic.Label>
                                    </Statistic>
                                    <Statistic color={pending > 0 ? "orange" : "grey"}>
                                        <Statistic.Value>{pending}</Statistic.Value>
                                        <Statistic.Label>Pendentes</Statistic.Label>
                                    </Statistic>
                                </Statistic.Group>

                                <Progress
                                    percent={pct}
                                    indicating={pct < 100}
                                    success={pct === 100 && total > 0}
                                    size="small"
                                    style={{ marginBottom: '5px' }}
                                >
                                    {pct}% / {total} Total
                                </Progress>
                            </Segment>
                        </Grid.Column>
                    );
                })}
            </Grid>
        </div>
    );
});

export default PerformanceDashboard;
