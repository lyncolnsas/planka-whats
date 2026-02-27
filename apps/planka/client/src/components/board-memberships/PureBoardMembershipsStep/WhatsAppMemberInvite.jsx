/*!
 * WhatsApp Member Invite component
 * Shows WhatsApp contact suggestions and allows manual phone entry
 * to invite someone to a board and send them a welcome message.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Divider, Form, Icon, Input, Label, List } from 'semantic-ui-react';

import { getWhatsAppContacts, notifyWhatsAppMember } from '../../../lib/bridgeApi';

const PHONE_REGEX = /^\d{8,15}$/;

/** Normalize phone: strip non-digits and leading + */
const normalizePhone = (raw) => raw.replace(/\D/g, '');

const WhatsAppMemberInvite = React.memo(({ searchTerm, boardName, currentUserName }) => {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [sending, setSending] = useState(false);
    const [sentTo, setSentTo] = useState(null);
    const [error, setError] = useState(null);

    // Manual entry state
    const [manualName, setManualName] = useState('');
    const [manualPhone, setManualPhone] = useState('');

    const fetchContacts = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        const data = await getWhatsAppContacts();
        setContacts(Array.isArray(data) ? data : []);
        setLoading(false);
        setRefreshing(false);
    }, []);

    // Load contacts from bridge API once
    useEffect(() => {
        fetchContacts(false);
    }, [fetchContacts]);


    const cleanSearch = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);

    const filteredContacts = useMemo(() => {
        if (!cleanSearch) return contacts.slice(0, 8);
        return contacts
            .filter((c) => {
                const name = (c.name || c.notify || '').toLowerCase();
                const phone = (c.id || '').replace('@s.whatsapp.net', '');
                return name.includes(cleanSearch) || phone.includes(cleanSearch);
            })
            .slice(0, 8);
    }, [contacts, cleanSearch]);

    const sendInvite = useCallback(
        async (phone, displayName) => {
            setSending(true);
            setError(null);
            try {
                await notifyWhatsAppMember(normalizePhone(phone), boardName, currentUserName);
                setSentTo(displayName);
            } catch (err) {
                setError('Falha ao enviar. Verifique se o WhatsApp está conectado.');
            } finally {
                setSending(false);
            }
        },
        [boardName, currentUserName],
    );

    const handleContactClick = useCallback(
        (contact) => {
            const phone = (contact.id || '').replace('@s.whatsapp.net', '');
            const displayName = contact.name || contact.notify || phone;
            sendInvite(phone, displayName);
        },
        [sendInvite],
    );

    const handleManualSend = useCallback(() => {
        if (!PHONE_REGEX.test(normalizePhone(manualPhone))) {
            setError('Número inválido. Use apenas dígitos (ex: 5511999998888).');
            return;
        }
        sendInvite(manualPhone, manualName || manualPhone);
    }, [manualName, manualPhone, sendInvite]);

    if (loading) return null; // don't show anything until first load

    return (
        <>
            {/* Section header with refresh button */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0 6px', color: '#5e6c84', fontSize: 11 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(34,36,38,0.15)' }} />
                <span style={{ margin: '0 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="whatsapp" color="green" style={{ margin: 0 }} />
                    Convidar via WhatsApp
                </span>
                <Button
                    icon
                    size="mini"
                    basic
                    circular
                    loading={refreshing}
                    disabled={refreshing}
                    title="Atualizar lista de contatos"
                    onClick={() => fetchContacts(true)}
                    style={{ padding: '2px 5px', margin: 0, boxShadow: 'none' }}
                >
                    {!refreshing && <Icon name="refresh" style={{ margin: 0, fontSize: 11 }} />}
                </Button>
                <div style={{ flex: 1, height: 1, background: 'rgba(34,36,38,0.15)' }} />
            </div>

            {sentTo ? (
                <div style={{ padding: '6px 4px', color: '#5aac44', fontSize: 13 }}>
                    <Icon name="check circle" /> Convite enviado para <strong>{sentTo}</strong>!
                </div>
            ) : (
                <>
                    {/* Matched contacts */}
                    {filteredContacts.length > 0 && (
                        <List selection verticalAlign="middle" style={{ marginTop: 0 }}>
                            {filteredContacts.map((c) => {
                                const phone = (c.id || '').replace('@s.whatsapp.net', '');
                                const displayName = c.name || c.notify || phone;
                                return (
                                    <List.Item
                                        key={c.id}
                                        onClick={() => handleContactClick(c)}
                                        style={{ padding: '5px 4px', cursor: 'pointer' }}
                                    >
                                        <Icon name="whatsapp" color="green" />
                                        <List.Content>
                                            <List.Header style={{ fontSize: 13 }}>{displayName}</List.Header>
                                            <List.Description style={{ fontSize: 11 }}>{phone}</List.Description>
                                        </List.Content>
                                    </List.Item>
                                );
                            })}
                        </List>
                    )}

                    {/* Manual entry (always shown) */}
                    <Form size="small" style={{ marginTop: 6 }}>
                        <Form.Group widths="equal" style={{ marginBottom: 4 }}>
                            <Form.Field>
                                <Input
                                    fluid
                                    size="mini"
                                    placeholder="Nome (opcional)"
                                    value={manualName}
                                    onChange={(e) => setManualName(e.target.value)}
                                />
                            </Form.Field>
                            <Form.Field>
                                <Input
                                    fluid
                                    size="mini"
                                    placeholder="Telefone (5511...)"
                                    value={manualPhone}
                                    onChange={(e) => setManualPhone(e.target.value)}
                                />
                            </Form.Field>
                        </Form.Group>
                        <Button
                            size="mini"
                            color="green"
                            fluid
                            loading={sending}
                            disabled={sending || !manualPhone}
                            onClick={handleManualSend}
                        >
                            <Icon name="paper plane" />
                            Enviar Convite WhatsApp
                        </Button>
                    </Form>

                    {error && (
                        <Label basic color="red" style={{ marginTop: 6, fontSize: 11 }}>
                            {error}
                        </Label>
                    )}
                </>
            )}
        </>
    );
});

WhatsAppMemberInvite.propTypes = {
    searchTerm: PropTypes.string.isRequired,
    boardName: PropTypes.string.isRequired,
    currentUserName: PropTypes.string.isRequired,
};

export default WhatsAppMemberInvite;
