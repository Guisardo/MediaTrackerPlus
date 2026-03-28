import _ from 'lodash';

import { User, userNonSensitiveColumns, userSelfColumns } from 'src/entity/user';
import { userRepository } from 'src/repository/user';
import { Database } from 'src/dbconfig';
import {
  Notifications,
  NotificationPlatformsCredentialsType,
  NotificationPlatformsResponseType,
} from 'src/notifications/notifications';
import { createExpressRoute } from 'typescript-routes-to-openapi-server';
import { localAuthentication } from 'src/auth';
import { notificationPlatformsCredentialsRepository } from 'src/repository/notificationPlatformsCredentials';
import { configurationRepository } from 'src/repository/globalSettings';
import { RequestError, toRequestErrorObject } from 'src/requestError';
import { Config } from 'src/config';
import { t } from '@lingui/macro';
import { formatNotification } from 'src/notifications/notificationFormatter';

type UserResponse = Omit<User, 'password'>;

/**
 * @openapi_tags User
 */
export class UsersController {
  /**
   * @openapi_operationId get
   */
  get = createExpressRoute<{
    path: '/api/user';
    method: 'get';
    responseBody: null | UserResponse;
  }>(async (req, res) => {
    if (typeof req.user === 'number') {
      // Use findOneSelf to include the self-only dateOfBirth field.
      const user = await userRepository.findOneSelf({ id: req.user });
      res.send(user ?? null);
    } else {
      res.send(null);
    }
  });

  /**
   * @openapi_operationId logout
   */
  logout = createExpressRoute<{
    path: '/api/user/logout';
    method: 'get';
  }>(async (req, res, next) => {
    req.logout((err) => {
      if (err) {
        return next(err);
      }
      res.redirect('/');
    });
  });

  /**
   * @openapi_operationId login
   */
  login = createExpressRoute<{
    path: '/api/user/login';
    method: 'post';
    requestBody: {
      username: string;
      password: string;
    };
  }>(localAuthentication, async (req, res) => {
    const user = await userRepository.findOne({ id: Number(req.user) });
    res.send(user);
  });

  /**
   * @openapi_operationId register
   */
  register = createExpressRoute<{
    path: '/api/user/register';
    method: 'post';
    requestBody: {
      username: string;
      password: string;
      confirmPassword: string;
    };
    responseBody: UserResponse | RequestError;
  }>(
    async (req, res, next) => {
      if (Config.DEMO) {
        res.sendStatus(401);
        return;
      }

      const configuration = await configurationRepository.get();
      const usersCount = await userRepository.count();

      if (usersCount > 0 && !configuration?.enableRegistration) {
        res.sendStatus(401);
        return;
      }

      const { username, password, confirmPassword } = req.body;
      const user = await userRepository.findOne({ name: username });

      if (user) {
        res.send(toRequestErrorObject(t`User already exists`));
        return;
      }

      if (password !== confirmPassword) {
        res.send(toRequestErrorObject(t`Passwords do not match`));
        return;
      }

      if (password.trim().length === 0) {
        res.send(toRequestErrorObject(t`Password cannot be empty`));
        return;
      }

      if (username.trim().length === 0) {
        res.send(toRequestErrorObject(t`Username cannot be empty`));
        return;
      }

      await userRepository.create({
        name: username,
        password: password,
        admin: usersCount === 0,
      });

      next();
    },
    localAuthentication,
    async (req, res) => {
      const user = await userRepository.findOne({ id: Number(req.user) });
      res.send(user);
    }
  );

  /**
   * @openapi_operationId getNotificationCredentials
   */
  getNotificationCredentials = createExpressRoute<{
    path: '/api/user/notification-credentials';
    method: 'get';
    responseBody: {
      [N in keyof NotificationPlatformsCredentialsType]?: NotificationPlatformsCredentialsType[N];
    };
  }>(async (req, res) => {
    const userId = Number(req.user);

    const credentials = await notificationPlatformsCredentialsRepository.get(
      userId
    );

    res.send(credentials);
  });

  /**
   * @openapi_operationId updateNotificationCredentials
   */
  updateNotificationCredentials = createExpressRoute<{
    path: '/api/user/notification-credentials';
    method: 'put';
    requestBody: NotificationPlatformsResponseType;
  }>(async (req, res) => {
    const userId = Number(req.user);

    const { platformName, credentials } = req.body;

    try {
      await Notifications.sendNotification(platformName, {
        message: formatNotification(() => t`Test message`),
        credentials: credentials,
      });
    } catch (error) {
      res.status(400);
      res.send(error instanceof Error ? error.toString() : String(error));
      return;
    }

    await notificationPlatformsCredentialsRepository.delete({
      platformName: platformName,
      userId: userId,
    });

    await notificationPlatformsCredentialsRepository.createMany(
      Object.entries(credentials).map(([key, value]) => ({
        platformName: platformName,
        name: key,
        value: value.toString(),
        userId: userId,
      }))
    );

    res.sendStatus(200);
  });

  /**
   * @openapi_operationId update
   */
  update = createExpressRoute<{
    path: '/api/user/settings';
    method: 'put';
    requestBody: Partial<
      Pick<
        User,
        Exclude<(typeof userNonSensitiveColumns)[number], 'id' | 'admin'>
      > & Pick<User, 'dateOfBirth'>
    >;
  }>(async (req, res) => {
    const userId = Number(req.user);
    // Pick the shared non-sensitive settings fields (excludes dateOfBirth).
    const newUserSettings = _.pick(req.body, userNonSensitiveColumns);

    // `dateOfBirth` is self-only and not in userNonSensitiveColumns, so it
    // must be extracted explicitly. Accept string, null, or undefined.
    const dateOfBirthUpdate: { dateOfBirth?: string | null } = {};
    if ('dateOfBirth' in req.body) {
      dateOfBirthUpdate.dateOfBirth =
        req.body.dateOfBirth === null || req.body.dateOfBirth === undefined
          ? null
          : String(req.body.dateOfBirth);
    }

    await userRepository.update({
      id: userId,
      ...newUserSettings,
      ...dateOfBirthUpdate,
    });

    res.sendStatus(200);
  });

  /**
   * @openapi_operationId updatePassword
   */
  updatePassword = createExpressRoute<{
    path: '/api/user/password';
    method: 'put';
    requestBody: {
      currentPassword: string;
      newPassword: string;
    };
  }>(async (req, res) => {
    if (Config.DEMO) {
      res.sendStatus(403);
      return;
    }

    const userId = Number(req.user);

    const { currentPassword, newPassword } = req.body;

    if (newPassword.trim().length === 0) {
      res.sendStatus(400);
      return;
    }

    const user = await userRepository.findOneWithPassword({ id: userId });

    if (!user || !(await userRepository.verifyPassword(user, currentPassword))) {
      res.sendStatus(401);
      return;
    }

    await userRepository.update({
      id: user.id,
      password: newPassword,
    });

    res.sendStatus(200);
  });

  /**
   * @openapi_operationId getById
   */
  getById = createExpressRoute<{
    path: '/api/user/:userId';
    method: 'get';
    pathParams: {
      userId: number;
    };
    responseBody: null | Pick<UserResponse, 'id' | 'name'>;
  }>(async (req, res) => {
    const { userId } = req.params;

    const user = await userRepository.findOne({ id: userId });

    if (user) {
      // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
      res.send(_.pick(user, ['id', 'name']));
    } else {
      res.send(null);
    }
  });

  /**
   * @openapi_operationId search
   */
  search = createExpressRoute<{
    path: '/api/users/search';
    method: 'get';
    requestQuery: {
      query: string;
    };
    responseBody: Array<Pick<UserResponse, 'id' | 'name'>>;
  }>(async (req, res) => {
    const userId = Number(req.user);
    const { query } = req.query;

    // Validate input
    if (typeof query !== 'string' || query.trim().length === 0) {
      res.status(400);
      res.send([]);
      return;
    }

    // Query database for users matching the search string (case-insensitive)
    const users = await Database.knex<User>('user')
      .where('name', 'like', `%${query}%`)
      .whereNot('id', userId)
      .select('id', 'name')
      .limit(20);

    // Return only id and name fields — safe: mapped to a plain {id, name} literal
    // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
    res.send(users.map(user => ({ id: user.id, name: user.name })));
  });
}
