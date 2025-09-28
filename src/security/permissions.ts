import winston from 'winston';
import { NextFunction } from 'express';

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Role {
  name: string;
  description: string;
  permissions: Permission[];
  inherits?: string[];
}

export interface SecurityAuditEvent {
  timestamp: number;
  userId?: string;
  action: string;
  resource: string;
  allowed: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}

export class PermissionSystem {
  private roles: Map<string, Role> = new Map();
  private userRoles: Map<string, string[]> = new Map();
  private auditLog: SecurityAuditEvent[] = [];
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.initializeDefaultRoles();
  }

  /**
   * Initialize default role definitions
   */
  private initializeDefaultRoles(): void {
    // Admin role - full access
    this.addRole({
      name: 'admin',
      description: 'Full system access',
      permissions: [
        { resource: '*', action: '*' }
      ]
    });

    // Operator role - all tools except system management
    this.addRole({
      name: 'operator',
      description: 'All browser automation tools',
      permissions: [
        { resource: 'navigation', action: '*' },
        { resource: 'interaction', action: '*' },
        { resource: 'extraction', action: '*' },
        { resource: 'conditions', action: '*' },
        { resource: 'audio', action: '*' },
        { resource: 'javascript', action: '*' },
        { resource: 'dialogs', action: '*' },
        { resource: 'storage', action: '*' },
        { resource: 'advancedExtraction', action: '*' },
        { resource: 'windows', action: '*' },
        { resource: 'frames', action: '*' },
        { resource: 'network', action: '*' },
        { resource: 'performance', action: '*' },
        { resource: 'session', action: 'get*' },
        { resource: 'session', action: 'list*' }
      ]
    });

    // Tester role - read and interaction tools only
    this.addRole({
      name: 'tester',
      description: 'Testing and interaction tools',
      permissions: [
        { resource: 'navigation', action: '*' },
        { resource: 'interaction', action: '*' },
        { resource: 'conditions', action: '*' },
        { resource: 'extraction', action: 'get*' },
        { resource: 'extraction', action: 'take*' },
        { resource: 'audio', action: 'check*' },
        { resource: 'audio', action: 'get*' },
        { resource: 'audio', action: 'monitor*' },
        { resource: 'javascript', action: 'evaluate*' },
        { resource: 'session', action: 'get*' },
        { resource: 'session', action: 'list*' }
      ]
    });

    // Viewer role - read-only tools
    this.addRole({
      name: 'viewer',
      description: 'Read-only access',
      permissions: [
        { resource: 'navigation', action: 'get*' },
        { resource: 'extraction', action: 'get*' },
        { resource: 'extraction', action: 'take*' },
        { resource: 'conditions', action: 'element_exists' },
        { resource: 'audio', action: 'get*' },
        { resource: 'audio', action: 'check*' },
        { resource: 'session', action: 'get*' },
        { resource: 'session', action: 'list*' },
        { resource: 'windows', action: 'get*' },
        { resource: 'frames', action: 'get*' },
        { resource: 'network', action: 'get*' },
        { resource: 'performance', action: 'get*' }
      ]
    });

    this.logger.info('Default roles initialized', {
      rolesCount: this.roles.size
    });
  }

  /**
   * Add a custom role
   */
  addRole(role: Role): void {
    this.roles.set(role.name, role);
    this.logger.debug('Role added', {
      name: role.name,
      permissionsCount: role.permissions.length
    });
  }

  /**
   * Assign roles to a user
   */
  assignUserRoles(userId: string, roleNames: string[]): void {
    const validRoles = roleNames.filter(roleName => this.roles.has(roleName));

    if (validRoles.length !== roleNames.length) {
      const invalidRoles = roleNames.filter(roleName => !this.roles.has(roleName));
      this.logger.warn('Invalid roles provided', {
        userId,
        invalidRoles
      });
    }

    this.userRoles.set(userId, validRoles);

    this.logger.info('User roles assigned', {
      userId,
      roles: validRoles
    });
  }

  /**
   * Check if user has permission for a specific action
   */
  hasPermission(
    userId: string | undefined,
    resource: string,
    action: string,
    context?: Record<string, any>
  ): { allowed: boolean; reason?: string } {
    const startTime = Date.now();

    try {
      // Get user roles
      const userRoleNames = userId ? this.userRoles.get(userId) || [] : [];

      if (userRoleNames.length === 0) {
        this.auditPermissionCheck(userId, resource, action, false, 'No roles assigned');
        return { allowed: false, reason: 'No roles assigned' };
      }

      // Check permissions for each role
      for (const roleName of userRoleNames) {
        const role = this.roles.get(roleName);
        if (!role) continue;

        // Get all permissions including inherited ones
        const allPermissions = this.getEffectivePermissions(role);

        // Check each permission
        for (const permission of allPermissions) {
          if (this.matchesPermission(permission, resource, action, context)) {
            this.auditPermissionCheck(userId, resource, action, true);
            return { allowed: true };
          }
        }
      }

      this.auditPermissionCheck(userId, resource, action, false, 'Permission denied');
      return { allowed: false, reason: 'Permission denied' };

    } catch (error) {
      this.logger.error('Permission check error', {
        userId,
        resource,
        action,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.auditPermissionCheck(userId, resource, action, false, 'System error');
      return { allowed: false, reason: 'System error' };
    }
  }

  /**
   * Get effective permissions including inherited roles
   */
  private getEffectivePermissions(role: Role): Permission[] {
    const permissions: Permission[] = [...role.permissions];

    // Add inherited permissions
    if (role.inherits) {
      for (const inheritedRoleName of role.inherits) {
        const inheritedRole = this.roles.get(inheritedRoleName);
        if (inheritedRole) {
          permissions.push(...this.getEffectivePermissions(inheritedRole));
        }
      }
    }

    return permissions;
  }

  /**
   * Check if permission matches resource and action
   */
  private matchesPermission(
    permission: Permission,
    resource: string,
    action: string,
    context?: Record<string, any>
  ): boolean {
    // Check resource match
    if (permission.resource !== '*' && permission.resource !== resource) {
      return false;
    }

    // Check action match
    if (permission.action !== '*') {
      if (permission.action.endsWith('*')) {
        // Wildcard action (e.g., 'get*')
        const prefix = permission.action.slice(0, -1);
        if (!action.startsWith(prefix)) {
          return false;
        }
      } else if (permission.action !== action) {
        return false;
      }
    }

    // Check conditions if specified
    if (permission.conditions && context) {
      for (const [key, expectedValue] of Object.entries(permission.conditions)) {
        if (context[key] !== expectedValue) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Audit permission check
   */
  private auditPermissionCheck(
    userId: string | undefined,
    resource: string,
    action: string,
    allowed: boolean,
    reason?: string
  ): void {
    const auditEvent: SecurityAuditEvent = {
      timestamp: Date.now(),
      userId,
      action,
      resource,
      allowed,
      reason
    };

    this.auditLog.push(auditEvent);

    // Keep only last 1000 events
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }

    // Log security events
    if (!allowed) {
      this.logger.warn('Permission denied', auditEvent);
    } else {
      this.logger.debug('Permission granted', auditEvent);
    }
  }

  /**
   * Get audit log
   */
  getAuditLog(limit: number = 100): SecurityAuditEvent[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * Get user permissions
   */
  getUserPermissions(userId: string): Permission[] {
    const userRoleNames = this.userRoles.get(userId) || [];
    const permissions: Permission[] = [];

    for (const roleName of userRoleNames) {
      const role = this.roles.get(roleName);
      if (role) {
        permissions.push(...this.getEffectivePermissions(role));
      }
    }

    return permissions;
  }

  /**
   * List all available roles
   */
  listRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  /**
   * Get role by name
   */
  getRole(name: string): Role | undefined {
    return this.roles.get(name);
  }

  /**
   * Remove role
   */
  removeRole(name: string): boolean {
    return this.roles.delete(name);
  }

  /**
   * Update role permissions
   */
  updateRole(name: string, updates: Partial<Role>): boolean {
    const role = this.roles.get(name);
    if (!role) {
      return false;
    }

    const updatedRole = { ...role, ...updates };
    this.roles.set(name, updatedRole);

    this.logger.info('Role updated', {
      name,
      permissionsCount: updatedRole.permissions.length
    });

    return true;
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(userId: string, roleNames: string[]): boolean {
    const userRoleNames = this.userRoles.get(userId) || [];
    return roleNames.some(roleName => userRoleNames.includes(roleName));
  }

  /**
   * Check if user has all of the specified roles
   */
  hasAllRoles(userId: string, roleNames: string[]): boolean {
    const userRoleNames = this.userRoles.get(userId) || [];
    return roleNames.every(roleName => userRoleNames.includes(roleName));
  }

  /**
   * Create permission middleware for Express
   */
  createPermissionMiddleware(resource: string, action: string) {
    return (req: any, res: any, next: NextFunction) => {
      const authContext = req.authContext;

      if (!authContext) {
        return res.status(401).json({
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required'
          }
        });
      }

      const permissionCheck = this.hasPermission(
        authContext.userId,
        resource,
        action,
        { ip: authContext.ipAddress }
      );

      if (!permissionCheck.allowed) {
        this.logger.warn('Permission denied for tool access', {
          userId: authContext.userId,
          resource,
          action,
          reason: permissionCheck.reason
        });

        return res.status(403).json({
          error: {
            code: 'PERMISSION_DENIED',
            message: permissionCheck.reason || 'Permission denied',
            resource,
            action
          }
        });
      }

      next();
    };
  }
}