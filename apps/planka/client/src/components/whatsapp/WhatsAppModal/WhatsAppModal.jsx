/*!
 * WhatsAppModal — Rich management modal
 * Shows connection status, contacts list, and action buttons (refresh, disconnect).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
    Button,
    Divider,
    Header,
    Icon,
    Input,
    List,
    Loader,
    Message,
    Segment,
} from 'semantic-ui-react';

import entryActions from '../../../entry-actions';
import { useClosableModal } from '../../../hooks';
import {
    disconnectWhatsApp,
    getWhatsAppContacts,
    getWhatsAppQR,
    restartWhatsApp,
} from '../../../lib/bridgeApi';

import styles from './WhatsAppModal.module.scss';

const WhatsAppModal = React.memo(() => {
    const dispatch = useDispatch();
    const [ClosableModal] = useClosableModal();

    const [contacts, setContacts] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncFinished, setSyncFinished] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [qrImageUrl, setQrImageUrl] = useState(null);
    const [disconnecting, setDisconnecting] = useState(false);
    const [statusNote, setStatusNote] = useState(null);

    const handleClose = useCallback(() => {
        dispatch(entryActions.closeModal());
    }, [dispatch]);

    // Check connection status and get QR if needed
    const checkStatus = useCallback(async () => {
        try {
            const data = await getWhatsAppQR();
            setIsConnected(data.connected);
            setQrImageUrl(data.qr);
            return data.connected;
        } catch {
            setIsConnected(false);
            setQrImageUrl(null);
            return false;
        }
    }, []);

    const fetchContacts = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true);
        const data = await getWhatsAppContacts();
        const validData = Array.isArray(data) ? data : [];

        setContacts((prev) => {
            if (prev.length < validData.length) {
                setIsSyncing(true);
                setSyncFinished(false);
            } else if (isSyncing && prev.length === validData.length && validData.length > 0) {
                // If it stopped growing, mark as finished after a short delay in UI
                setTimeout(() => {
                    setIsSyncing(false);
                    setSyncFinished(true);
                }, 2000);
            }
            return validData;
        });

        setLoading(false);
    }, [isSyncing]);

    const handleRestart = useCallback(async () => {
        setQrImageUrl(null);
        setStatusNote('Reiniciando conexão...');
        try {
            await restartWhatsApp();
            setTimeout(checkStatus, 1000);
        } catch {
            setStatusNote('Erro ao reiniciar.');
        } finally {
            setTimeout(() => setStatusNote(null), 3000);
        }
    }, [checkStatus]);

    useEffect(() => {
        checkStatus().then((connected) => {
            if (connected) fetchContacts();
        });

        // Fast poll for contacts and status when modal is open
        const interval = setInterval(async () => {
            const connected = await checkStatus();
            if (connected) {
                fetchContacts(true); // quiet update
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [fetchContacts, checkStatus]);

    const handleDisconnect = useCallback(async () => {
        if (!window.confirm('Deseja desconectar o WhatsApp? Você precisará escanear o QR Code novamente.')) return;
        setDisconnecting(true);
        await disconnectWhatsApp();
        setContacts([]);
        setIsConnected(false);
        setQrImageUrl(null);
        setIsSyncing(false);
        setSyncFinished(false);
        setDisconnecting(false);
        setStatusNote('WhatsApp desconectado!');
        checkStatus();
    }, [checkStatus]);

    const filteredContacts = contacts.filter((c) => {
        if (!search) return true;
        const name = (c.name || c.notify || '').toLowerCase();
        const phone = (c.id || '').replace('@s.whatsapp.net', '');
        return name.includes(search.toLowerCase()) || phone.includes(search);
    });

    return (
        <ClosableModal
            open
            closeIcon
            size="small"
            centered={false}
            className={styles.wrapper}
            onClose={handleClose}
        >
            <ClosableModal.Header>
                <Header as="h3" style={{ margin: 0 }}>
                    <Icon name="whatsapp" color={isConnected ? 'green' : 'grey'} />
                    WhatsApp
                    <Header.Subheader>
                        {isConnected ? (
                            <span style={{ color: '#5aac44' }}>● Conectado</span>
                        ) : (
                            <span style={{ color: '#9e9e9e' }}>○ Desconectado</span>
                        )}
                    </Header.Subheader>
                </Header>
            </ClosableModal.Header>

            <ClosableModal.Content scrolling className={styles.content}>
                {/* Connection Section / QR Code */}
                {!isConnected && (
                    <Segment placeholder textAlign="center" style={{ marginBottom: 20 }}>
                        {qrImageUrl ? (
                            <>
                                <Header as="h4">Escanear QR Code</Header>
                                <img
                                    src={qrImageUrl}
                                    alt="WhatsApp QR Code"
                                    style={{ width: 200, height: 200, margin: '10px auto', display: 'block' }}
                                />
                                <p style={{ fontSize: 11, color: '#666' }}>
                                    Abra o WhatsApp {' > '} Aparelhos conectados {' > '} Conectar um aparelho
                                </p>
                                <Button
                                    size="mini"
                                    icon="refresh"
                                    content="Recarregar QR"
                                    onClick={checkStatus}
                                />
                            </>
                        ) : (
                            <div style={{ padding: '40px 20px' }}>
                                <Loader active inline="centered" size="large" style={{ marginBottom: 20 }}>
                                    <span style={{ color: '#333', fontWeight: 'bold' }}>Gerando QR Code...</span>
                                </Loader>
                                <p style={{ marginTop: 15, fontSize: 13, color: '#444' }}>
                                    Aguarde enquanto o Bridge prepara a conexão segura.
                                </p>
                                <Button
                                    basic
                                    size="mini"
                                    icon="sync"
                                    content="Tentar novamente"
                                    onClick={handleRestart}
                                    style={{ marginTop: 20 }}
                                />
                            </div>
                        )}
                    </Segment>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <Button
                        size="small"
                        icon="refresh"
                        labelPosition="left"
                        content="Atualizar lista"
                        loading={loading}
                        disabled={loading || !isConnected}
                        onClick={fetchContacts}
                    />
                    {isConnected && (
                        <Button
                            size="small"
                            color="red"
                            basic
                            icon="sign out"
                            labelPosition="left"
                            content="Desconectar"
                            loading={disconnecting}
                            disabled={disconnecting}
                            onClick={handleDisconnect}
                        />
                    )}
                </div>

                {statusNote && (
                    <Message size="mini" positive style={{ marginBottom: 10 }}>
                        {statusNote}
                    </Message>
                )}

                {isSyncing && (
                    <Message size="mini" info icon style={{ marginBottom: 10, padding: '8px 12px' }}>
                        <Icon name="circle notched" loading />
                        <Message.Content>
                            <Message.Header style={{ fontSize: 13 }}>Sincronizando contatos...</Message.Header>
                            Encontrados {contacts.length} até agora.
                        </Message.Content>
                    </Message>
                )}

                {!isSyncing && syncFinished && (
                    <Message size="mini" positive icon style={{ marginBottom: 10, padding: '8px 12px' }}>
                        <Icon name="check circle" />
                        <Message.Content>
                            <Message.Header style={{ fontSize: 13 }}>Contatos Sincronizados</Message.Header>
                            Total de {contacts.length} contatos carregados.
                        </Message.Content>
                    </Message>
                )}

                <Divider horizontal style={{ fontSize: 11, color: '#5e6c84' }}>
                    Contatos ({filteredContacts.length})
                </Divider>

                {/* Search */}
                <Input
                    fluid
                    icon="search"
                    placeholder="Buscar contato (nome ou número)..."
                    size="small"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ marginBottom: 10 }}
                />

                {/* Contacts list */}
                {loading ? (
                    <Segment basic style={{ textAlign: 'center', padding: '30px 0' }}>
                        <Loader active inline="centered" content="Carregando contatos..." />
                    </Segment>
                ) : filteredContacts.length === 0 ? (
                    <Message size="small" info>
                        {contacts.length === 0
                            ? 'Nenhum contato sincronizado. Certifique-se de que o WhatsApp está conectado.'
                            : 'Nenhum contato encontrado.'}
                    </Message>
                ) : (
                    <List divided relaxed style={{ maxHeight: 350, overflowY: 'auto' }}>
                        {filteredContacts.map((c) => {
                            const phone = (c.id || '').replace('@s.whatsapp.net', '');
                            const displayName = c.name || c.notify || phone;
                            return (
                                <List.Item key={c.id}>
                                    <List.Icon name="whatsapp" color="green" verticalAlign="middle" size="large" />
                                    <List.Content>
                                        <List.Header style={{ fontSize: 13 }}>{displayName}</List.Header>
                                        <List.Description style={{ fontSize: 11, color: '#6b778c' }}>
                                            {phone}
                                        </List.Description>
                                    </List.Content>
                                </List.Item>
                            );
                        })}
                    </List>
                )}
            </ClosableModal.Content>
        </ClosableModal>
    );
});

export default WhatsAppModal;
