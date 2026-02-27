/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useState } from 'react';
import { Button, Form, Header, Icon, Image, Input, Tab } from 'semantic-ui-react';

import defaultLogoSrc from '../../../assets/images/logo.png';

const STORAGE_KEY = 'planka_logo_url';

const AppearancePane = React.memo(() => {
    const [logoUrl, setLogoUrl] = useState(
        () => localStorage.getItem(STORAGE_KEY) || '',
    );
    const [saved, setSaved] = useState(false);

    const previewSrc = logoUrl.trim() || defaultLogoSrc;

    const handleChange = useCallback((e) => {
        setLogoUrl(e.target.value);
        setSaved(false);
    }, []);

    const handleSave = useCallback(() => {
        if (logoUrl.trim()) {
            localStorage.setItem(STORAGE_KEY, logoUrl.trim());
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
        setSaved(true);
        // Force header to re-read localStorage on next render cycle
        window.dispatchEvent(new Event('planka_logo_changed'));
    }, [logoUrl]);

    const handleReset = useCallback(() => {
        setLogoUrl('');
        localStorage.removeItem(STORAGE_KEY);
        setSaved(true);
        window.dispatchEvent(new Event('planka_logo_changed'));
    }, []);

    return (
        <Tab.Pane>
            <Header as="h4" dividing>
                <Icon name="image" />
                Logo do Sistema
            </Header>
            <p style={{ color: '#5e6c84', marginBottom: 16 }}>
                Insira a URL de uma imagem para substituir o logotipo padrão do Planka no cabeçalho.
                Deixe em branco para usar o logo original.
            </p>

            <Form>
                <Form.Field>
                    <label>URL da Logo</label>
                    <Input
                        fluid
                        placeholder="https://exemplo.com/sua-logo.png"
                        value={logoUrl}
                        onChange={handleChange}
                    />
                </Form.Field>

                <div style={{ marginTop: 16, marginBottom: 16 }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
                        Pré-visualização
                    </label>
                    <div
                        style={{
                            background: '#026aa7',
                            borderRadius: 8,
                            padding: '10px 16px',
                            display: 'inline-flex',
                            alignItems: 'center',
                        }}
                    >
                        <Image src={previewSrc} style={{ height: 28, width: 'auto', objectFit: 'contain' }} />
                    </div>
                </div>

                <Button primary onClick={handleSave}>
                    <Icon name="save" />
                    Salvar Logo
                </Button>
                <Button basic onClick={handleReset}>
                    <Icon name="undo" />
                    Restaurar Padrão
                </Button>

                {saved && (
                    <span style={{ marginLeft: 12, color: '#5aac44', fontWeight: 'bold' }}>
                        ✔ Salvo! Recarregue a página para ver o efeito no cabeçalho.
                    </span>
                )}
            </Form>
        </Tab.Pane>
    );
});

export default AppearancePane;
