/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Input, Popup } from '../../../../lib/custom-ui';

import selectors from '../../../../selectors';
import entryActions from '../../../../entry-actions';
import { useField, useNestedRef, useSteps } from '../../../../hooks';
import { isUserAdminOrProjectOwner } from '../../../../utils/record-helpers';
import { getWhatsAppContacts, syncWhatsAppUser, notifyWhatsAppMember } from '../../../../lib/bridgeApi';
import User from './User';
import WhatsAppUser from './WhatsAppUser';
import SelectPermissionsStep from '../SelectPermissionsStep';

import styles from './AddStep.module.scss';

const StepTypes = {
  SELECT_PERMISSIONS: 'SELECT_PERMISSIONS',
};

const AddStep = React.memo(({ onClose }) => {
  const users = useSelector((state) => {
    const user = selectors.selectCurrentUser(state);

    if (!isUserAdminOrProjectOwner(user)) {
      return [user];
    }

    return selectors.selectActiveUsers(state);
  });

  const currentUserIds = useSelector(selectors.selectMemberUserIdsForCurrentBoard);

  const dispatch = useDispatch();
  const [t] = useTranslation();
  const [step, openStep, handleBack] = useSteps();
  const [search, handleSearchChange] = useField('');
  const cleanSearch = useMemo(() => search.trim().toLowerCase(), [search]);

  const [waContacts, setWaContacts] = useState([]);
  const [waLoading, setWaLoading] = useState(false);
  const [waError, setWaError] = useState(null);

  useEffect(() => {
    getWhatsAppContacts().then(setWaContacts);
  }, []);

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          user.name.toLowerCase().includes(cleanSearch) ||
          (user.username && user.username.includes(cleanSearch)),
      ),
    [users, cleanSearch],
  );

  const filteredWaContacts = useMemo(() => {
    if (!cleanSearch) return [];
    return waContacts.filter(c => {
      const name = (c.name || c.notify || '').toLowerCase();
      const phone = (c.id || '').replace('@s.whatsapp.net', '');
      // Don't show if already in Planka users list
      const alreadyInPlanka = users.some(u => u.username === `wa_${phone}`);
      if (alreadyInPlanka) return false;

      return name.includes(cleanSearch) || phone.includes(cleanSearch);
    }).slice(0, 5);
  }, [waContacts, cleanSearch, users]);

  const [searchFieldRef, handleSearchFieldRef] = useNestedRef('inputRef');

  const board = useSelector(selectors.selectCurrentBoard);
  const currentUser = useSelector(selectors.selectCurrentUser);

  const handleRoleSelect = useCallback(
    (data) => {
      // CRITICAL: Planka board memberships only accept 'editor' or 'viewer'.
      // 'admin' is a project-level role handled exclusively by the bridge API.
      // If WA "admin" role is chosen, we add them as 'editor' to the board,
      // and let the backend promote them to Project Manager via notifyWhatsAppMember.
      const boardRole = data.role === 'admin' ? 'editor' : data.role;

      dispatch(
        entryActions.createMembershipInCurrentBoard({
          ...data,
          role: boardRole,
          userId: step.params.userId,
        }),
      );

      if (step.params.isWaInvite && step.params.phone) {
        // Pass the ORIGINAL role (including 'admin') so the backend
        // can apply Project Manager promotion when needed.
        // Also pass contactName so the user is created with the correct name.
        notifyWhatsAppMember(
          step.params.phone,
          board?.name || 'Quadro',
          currentUser?.name || 'Alguém',
          board?.id,
          data.role,
          step.params.contactName,
        ).catch(() => { });
      }

      onClose();
    },
    [onClose, dispatch, step, board, currentUser],
  );

  const handleUserSelect = useCallback(
    (userId) => {
      openStep(StepTypes.SELECT_PERMISSIONS, {
        userId,
      });
    },
    [openStep],
  );

  const handleWaUserSelect = useCallback(async (phone, name) => {
    setWaLoading(true);
    setWaError(null);

    try {
      // syncWhatsAppUser now validates the response (throws on error or missing id)
      const user = await syncWhatsAppUser(phone, name);

      // Dispatch to Redux store so UserAvatar and other components can find this user
      dispatch(entryActions.handleUserCreate(user));

      openStep(StepTypes.SELECT_PERMISSIONS, {
        userId: user.id,
        isWaInvite: true,
        phone,
        contactName: name, // Preserve real WA contact name for notify-member
        tempUser: user,
      });
    } catch (err) {
      // Show error message instead of silently failing
      setWaError(err?.message || 'Erro ao sincronizar contato. Tente novamente.');
    } finally {
      setWaLoading(false);
    }
  }, [openStep, dispatch]);

  useEffect(() => {
    if (searchFieldRef.current) {
      searchFieldRef.current.focus({
        preventScroll: true,
      });
    }
  }, [searchFieldRef]);

  // FIXED: Use state-based navigation instead of calling openStep(null) during render.
  // Calling setState during render causes React to crash (tela azul).
  if (step && step.type === StepTypes.SELECT_PERMISSIONS) {
    // Find user: first in Redux store, then fallback to tempUser from WA sync
    const selectedUser = users.find((user) => user.id === step.params.userId)
      || step.params.tempUser;

    // Validate user has a real id before rendering SelectPermissionsStep
    if (selectedUser && selectedUser.id) {
      return (
        <SelectPermissionsStep
          buttonContent="action.addMember"
          isWaInvite={step.params.isWaInvite}
          onSelect={handleRoleSelect}
          onBack={handleBack}
          onClose={onClose}
        />
      );
    }

    // If no valid user found, go back to search (via handleBack, not direct setState)
    // This avoids calling openStep(null) during render which crashes React
    return (
      <>
        <Popup.Header>
          {t('common.addMember', { context: 'title' })}
        </Popup.Header>
        <Popup.Content>
          <p style={{ color: 'red', padding: '8px' }}>
            ⚠️ Usuário não encontrado. Tente novamente.
          </p>
        </Popup.Content>
      </>
    );
  }

  return (
    <>
      <Popup.Header>
        {t('common.addMember', {
          context: 'title',
        })}
      </Popup.Header>
      <Popup.Content>
        <Input
          fluid
          ref={handleSearchFieldRef}
          value={search}
          placeholder={t('common.searchUsers')}
          maxLength={128}
          icon="search"
          onChange={handleSearchChange}
        />
        {waLoading && (
          <div style={{ padding: '8px', color: '#888', fontSize: '0.9em' }}>
            ⏳ Sincronizando contato...
          </div>
        )}
        {waError && (
          <div style={{ padding: '8px', color: '#d32f2f', fontSize: '0.9em' }}>
            ❌ {waError}
          </div>
        )}
        {(filteredUsers.length > 0 || filteredWaContacts.length > 0) && (
          <div className={styles.users}>
            {filteredUsers.map((user) => (
              <User
                key={user.id}
                id={user.id}
                isActive={currentUserIds.includes(user.id)}
                onSelect={handleUserSelect}
              />
            ))}
            {filteredWaContacts.map((contact) => {
              const phone = (contact.id || '').replace('@s.whatsapp.net', '');
              const name = contact.name || contact.notify || phone;
              return (
                <WhatsAppUser
                  key={contact.id}
                  name={name}
                  phone={phone}
                  isActive={false}
                  onSelect={handleWaUserSelect}
                />
              );
            })}
          </div>
        )}
      </Popup.Content>
    </>
  );
});

AddStep.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default AddStep;
