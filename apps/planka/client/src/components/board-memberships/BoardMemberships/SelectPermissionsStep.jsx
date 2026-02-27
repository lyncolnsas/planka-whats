/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { dequal } from 'dequal';
import omit from 'lodash/omit';
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button, Form, Icon, Menu, Radio, Segment } from 'semantic-ui-react';
import { Popup } from '../../../lib/custom-ui';

import { useForm } from '../../../hooks';
import { BoardMembershipRoles } from '../../../constants/Enums';
import { BoardMembershipRoleIcons } from '../../../constants/Icons';

import styles from './SelectPermissionsStep.module.scss';

const DESCRIPTION_BY_ROLE = {
  [BoardMembershipRoles.EDITOR]: 'common.canEditBoardLayoutAndAssignMembersToCards',
  [BoardMembershipRoles.VIEWER]: 'common.canOnlyViewBoard',
};

const WA_ROLES = ['admin', BoardMembershipRoles.EDITOR, BoardMembershipRoles.VIEWER];

const WA_DESCRIPTION_BY_ROLE = {
  admin: 'common.waAdminDescription',
  [BoardMembershipRoles.EDITOR]: 'common.waEditorDescription',
  [BoardMembershipRoles.VIEWER]: 'common.waViewerDescription',
};

const WA_LABEL_BY_ROLE = {
  admin: 'common.waAdmin',
  [BoardMembershipRoles.EDITOR]: 'common.waEditor',
  [BoardMembershipRoles.VIEWER]: 'common.waViewer',
};

const SelectPermissionsStep = React.memo(
  ({ boardMembership, title, buttonContent, isWaInvite, onSelect, onBack, onClose }) => {
    const [t] = useTranslation();

    const defaultData = useMemo(
      () =>
        boardMembership && {
          role: boardMembership.role,
          canComment: boardMembership.canComment,
        },
      [boardMembership],
    );

    const [data, handleFieldChange, setData] = useForm(() => ({
      role: BoardMembershipRoles.EDITOR,
      canComment: null,
      ...defaultData,
    }));

    const handleSubmit = useCallback(() => {
      // For WA invites: always call onSelect (role is always chosen)
      // For normal flow: only call onSelect if something changed
      if (isWaInvite || !dequal(data, defaultData)) {
        onSelect(
          data.role === BoardMembershipRoles.EDITOR || data.role === 'admin'
            ? omit(data, 'canComment')
            : data,
        );
      }
      // Always close — AddStep.handleRoleSelect will also call onClose(),
      // but closing twice is harmless (idempotent).
      onClose();
    }, [defaultData, onSelect, onClose, data, isWaInvite]);

    const handleSelectRoleClick = useCallback(
      (_, { value: role }) => {
        setData((prevData) => ({
          ...prevData,
          role,
          canComment: role === BoardMembershipRoles.EDITOR || role === 'admin' ? null : !!prevData.canComment,
        }));
      },
      [setData],
    );

    const currentRoles = isWaInvite ? WA_ROLES : [BoardMembershipRoles.EDITOR, BoardMembershipRoles.VIEWER];

    return (
      <>
        <Popup.Header onBack={onBack}>
          {t(title, {
            context: 'title',
          })}
        </Popup.Header>
        <Popup.Content>
          <Form onSubmit={handleSubmit}>
            <Menu secondary vertical className={styles.menu}>
              {currentRoles.map((role) => (
                <Menu.Item
                  key={role}
                  value={role}
                  active={role === data.role}
                  className={styles.menuItem}
                  onClick={handleSelectRoleClick}
                >
                  <Icon name={BoardMembershipRoleIcons[role] || 'user secret'} className={styles.menuItemIcon} />
                  <div className={styles.menuItemTitle}>
                    {isWaInvite ? t(WA_LABEL_BY_ROLE[role]) : t(`common.${role}`)}
                  </div>
                  <p className={styles.menuItemDescription}>
                    {isWaInvite ? t(WA_DESCRIPTION_BY_ROLE[role]) : t(DESCRIPTION_BY_ROLE[role])}
                  </p>
                </Menu.Item>
              ))}
            </Menu>
            {data.role !== BoardMembershipRoles.EDITOR && data.role !== 'admin' && (
              <Segment basic className={styles.settings}>
                <Radio
                  toggle
                  name="canComment"
                  checked={data.canComment}
                  label={t('common.canComment')}
                  className={styles.fieldRadio}
                  onChange={handleFieldChange}
                />
              </Segment>
            )}
            <Button positive content={t(buttonContent)} />
          </Form>
        </Popup.Content>
      </>
    );
  },
);

SelectPermissionsStep.propTypes = {
  boardMembership: PropTypes.object, // eslint-disable-line react/forbid-prop-types
  title: PropTypes.string,
  buttonContent: PropTypes.string,
  isWaInvite: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

SelectPermissionsStep.defaultProps = {
  boardMembership: undefined,
  title: 'common.selectPermissions',
  buttonContent: 'action.selectPermissions',
  isWaInvite: false,
};

export default SelectPermissionsStep;
