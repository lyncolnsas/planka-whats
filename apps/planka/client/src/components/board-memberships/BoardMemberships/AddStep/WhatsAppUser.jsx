import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Icon } from 'semantic-ui-react';

import styles from './User.module.scss';

const WhatsAppUser = React.memo(({ name, phone, isActive, onSelect }) => {
    const handleClick = useCallback(() => {
        onSelect(phone, name);
    }, [phone, name, onSelect]);

    return (
        <button type="button" disabled={isActive} className={styles.menuItem} onClick={handleClick}>
            <span className={styles.user} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e7f3ef' }}>
                <Icon name="whatsapp" color="green" style={{ margin: 0 }} />
            </span>
            <div className={classNames(styles.menuItemText, isActive && styles.menuItemTextActive)}>
                {name} <span style={{ fontSize: '0.8em', color: '#6b778c', marginLeft: 4 }}>({phone})</span>
            </div>
        </button>
    );
});

WhatsAppUser.propTypes = {
    name: PropTypes.string.isRequired,
    phone: PropTypes.string.isRequired,
    isActive: PropTypes.bool.isRequired,
    onSelect: PropTypes.func.isRequired,
};

export default WhatsAppUser;
