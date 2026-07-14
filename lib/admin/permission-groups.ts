/**
 * Patch 49A — readable permission groups mapped to MatrixPermission codes.
 */

import type { MatrixPermission } from "@/lib/auth/types";

export type PermissionGroup = {
  id: string;
  label: string;
  permissions: Array<{
    code: MatrixPermission;
    label: string;
    description: string;
    highRisk?: boolean;
  }>;
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "service-calls",
    label: "Service Calls",
    permissions: [
      {
        code: "VIEW_SERVICE_CALLS",
        label: "View Service Calls",
        description: "View service-call records.",
      },
      {
        code: "CREATE_SERVICE_CALL",
        label: "Create Service Calls",
        description: "Create new service calls.",
      },
      {
        code: "EDIT_SERVICE_CALL",
        label: "Edit Service Calls",
        description: "Edit existing service calls.",
      },
      {
        code: "ASSIGN_SERVICE_CALL",
        label: "Assign Service Calls",
        description: "Assign technicians to service calls.",
      },
      {
        code: "RESOLVE_SERVICE_CALL",
        label: "Complete Service Calls",
        description: "Resolve and complete service work.",
      },
      {
        code: "CANCEL_SERVICE_CALL",
        label: "Cancel Service Calls",
        description: "Cancel service calls.",
      },
      {
        code: "VIEW_FIELD_ALL_TECHNICIANS",
        label: "View All Technician Calls",
        description: "View work across technicians.",
        highRisk: true,
      },
    ],
  },
  {
    id: "pm",
    label: "Preventive Maintenance",
    permissions: [
      {
        code: "VIEW_FLEET_MAINTENANCE",
        label: "View Preventive Maintenance",
        description: "View PM dashboards and machine status.",
      },
      {
        code: "SCHEDULE_MAINTENANCE",
        label: "Create / Schedule PM Work",
        description: "Schedule preventive maintenance.",
      },
      {
        code: "COMPLETE_MAINTENANCE",
        label: "Complete PM Work",
        description: "Complete PM jobs.",
      },
      {
        code: "ASSIGN_MAINTENANCE",
        label: "Assign PM Work",
        description: "Assign PM work to technicians.",
      },
      {
        code: "VIEW_PM_INTELLIGENCE",
        label: "View PM Reports",
        description: "View PM intelligence reports.",
      },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    permissions: [
      {
        code: "VIEW_CUSTOMERS",
        label: "View Customers",
        description: "View customer records.",
      },
      {
        code: "MANAGE_CUSTOMERS",
        label: "Create / Edit Customers",
        description: "Create and edit customer accounts.",
      },
    ],
  },
  {
    id: "machines",
    label: "Machines",
    permissions: [
      {
        code: "VIEW_DIGITAL_TWIN",
        label: "View Machines",
        description: "View digital twin / machine records.",
      },
      {
        code: "EDIT_DIGITAL_TWIN",
        label: "Edit Machines",
        description: "Edit machine digital twin data.",
      },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    permissions: [
      {
        code: "VIEW_INVENTORY",
        label: "View Inventory",
        description: "View parts and stock.",
      },
      {
        code: "ADJUST_INVENTORY",
        label: "Adjust Inventory",
        description: "Adjust on-hand quantities.",
      },
      {
        code: "CREATE_PARTS_ORDER",
        label: "Order Parts",
        description: "Create parts orders.",
      },
      {
        code: "RECEIVE_INVENTORY",
        label: "Receive Parts",
        description: "Receive inventory into stock.",
      },
      {
        code: "TRANSFER_INVENTORY",
        label: "Transfer Parts",
        description: "Transfer stock between locations.",
      },
      {
        code: "MANAGE_WAREHOUSES",
        label: "Manage Warehouses",
        description: "Manage warehouse configuration.",
      },
      {
        code: "VIEW_INVENTORY_COSTS",
        label: "View Inventory Costs",
        description: "View cost and valuation data.",
        highRisk: true,
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    permissions: [
      {
        code: "VIEW_REPORTS",
        label: "View Reports",
        description: "View operational reports.",
      },
      {
        code: "VIEW_PM_EXECUTIVE",
        label: "View Executive Reports",
        description: "View executive PM reporting.",
      },
      {
        code: "EXPORT_MAINTENANCE",
        label: "Export Reports",
        description: "Export maintenance reports.",
      },
    ],
  },
  {
    id: "matrix-assist",
    label: "Matrix Assist",
    permissions: [
      {
        code: "USE_MATRIX_ASSIST",
        label: "Use Matrix Assist",
        description: "Use advisory diagnostics.",
      },
      {
        code: "VIEW_TEAM_DIAGNOSTIC_SESSIONS",
        label: "View Team Diagnostics",
        description: "View team diagnostic sessions.",
      },
      {
        code: "MANAGE_MATRIX_ASSIST_SETTINGS",
        label: "Manage Matrix Assist",
        description: "Configure Matrix Assist settings.",
        highRisk: true,
      },
      {
        code: "VIEW_AI_USAGE",
        label: "View AI Usage",
        description: "View AI usage metrics.",
      },
      {
        code: "MANAGE_TROUBLESHOOTING_TEMPLATES",
        label: "Manage Troubleshooting Templates",
        description: "Manage diagnostic templates.",
      },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    permissions: [
      {
        code: "VIEW_ADMINISTRATION",
        label: "View Administration",
        description: "Access the Administration Center.",
      },
      {
        code: "VIEW_ADMIN_OVERVIEW",
        label: "View Admin Overview",
        description: "View administration overview metrics.",
      },
      {
        code: "MANAGE_USERS",
        label: "Manage Users",
        description: "Manage user accounts and roles.",
        highRisk: true,
      },
      {
        code: "INVITE_USERS",
        label: "Invite Users",
        description: "Invite users when Clerk invitations are configured.",
        highRisk: true,
      },
      {
        code: "DEACTIVATE_USERS",
        label: "Deactivate Users",
        description: "Deactivate Matrix access without erasing history.",
        highRisk: true,
      },
      {
        code: "MANAGE_ROLES",
        label: "Manage Roles",
        description: "View and manage role definitions.",
        highRisk: true,
      },
      {
        code: "MANAGE_PERMISSIONS",
        label: "Manage Permissions",
        description: "Edit role permission sets.",
        highRisk: true,
      },
      {
        code: "MANAGE_ORGANIZATION_SETTINGS",
        label: "Manage Organization Settings",
        description: "Edit organization profile settings.",
        highRisk: true,
      },
      {
        code: "MANAGE_SYSTEM_CONFIGURATION",
        label: "Manage System Configuration",
        description: "Edit approved configuration values.",
        highRisk: true,
      },
      {
        code: "MANAGE_FEATURE_CONTROLS",
        label: "Manage Feature Controls",
        description: "Enable or disable product features.",
        highRisk: true,
      },
      {
        code: "VIEW_AUDIT_HISTORY",
        label: "View Audit History",
        description: "View administrative audit events.",
        highRisk: true,
      },
      {
        code: "VIEW_SECURITY_CENTER",
        label: "View Security Center",
        description: "View security warnings and access reviews.",
        highRisk: true,
      },
      {
        code: "VIEW_DATA_ADMINISTRATION",
        label: "View Data Administration",
        description: "Access operational data administration tools.",
      },
      {
        code: "MANAGE_OPERATIONAL_DATA",
        label: "Manage Operational Data",
        description: "Perform administrative corrections on operational records.",
        highRisk: true,
      },
      {
        code: "VIEW_DELETED_RECORDS",
        label: "View Deleted Records",
        description: "Review and restore soft-deleted records.",
        highRisk: true,
      },
      {
        code: "VIEW_RELATIONSHIP_IMPACT",
        label: "View Relationship Impact",
        description: "Review related records before archive or delete.",
      },
      {
        code: "PERFORM_BULK_DATA_ACTIONS",
        label: "Perform Bulk Data Actions",
        description: "Run limited bulk archive and status actions.",
        highRisk: true,
      },
      {
        code: "ADMIN_EDIT_SERVICE_CALL",
        label: "Admin Edit Service Calls",
        description: "Correct service-call operational fields.",
        highRisk: true,
      },
      {
        code: "DELETE_SERVICE_CALL",
        label: "Soft Delete Service Calls",
        description: "Soft delete invalid or test service calls.",
        highRisk: true,
      },
      {
        code: "RESTORE_SERVICE_CALL",
        label: "Restore Service Calls",
        description: "Restore soft-deleted or archived service calls.",
        highRisk: true,
      },
      {
        code: "EDIT_COMPLETED_SERVICE_CALL",
        label: "Edit Completed Service Calls",
        description: "Elevated edits to completed historical service calls.",
        highRisk: true,
      },
      {
        code: "ADMIN_EDIT_CUSTOMER",
        label: "Admin Edit Customers",
        description: "Correct customer operational fields.",
        highRisk: true,
      },
      {
        code: "ADMIN_EDIT_MACHINE",
        label: "Admin Edit Machines",
        description: "Correct machine operational fields.",
        highRisk: true,
      },
      {
        code: "ADMIN_EDIT_PM",
        label: "Admin Edit PM",
        description: "Correct preventive maintenance records.",
        highRisk: true,
      },
      {
        code: "ADMIN_EDIT_METER",
        label: "Admin Edit Meters",
        description: "Correct or invalidate meter readings.",
        highRisk: true,
      },
      {
        code: "ADMIN_EDIT_PART",
        label: "Admin Edit Parts",
        description: "Correct part metadata and inventory corrections.",
        highRisk: true,
      },
      {
        code: "CREATE_INVENTORY_CORRECTION",
        label: "Create Inventory Corrections",
        description: "Create corrective inventory transactions.",
        highRisk: true,
      },
      {
        code: "MANAGE_NOTIFICATION_SETTINGS",
        label: "Manage Notification Settings",
        description: "Administer notification channel settings.",
      },
      {
        code: "VIEW_EXECUTIVE_ADMIN_DASHBOARD",
        label: "View Executive Dashboard",
        description: "View scoped executive administration summaries.",
      },
      {
        code: "VIEW_ADMIN_REPORTS",
        label: "View Admin Reports",
        description: "View administrative report catalog.",
      },
      {
        code: "EXPORT_ADMIN_REPORTS",
        label: "Export Admin Reports",
        description: "Export administrative reports as CSV.",
        highRisk: true,
      },
      {
        code: "VIEW_USAGE_ANALYTICS",
        label: "View Usage Analytics",
        description: "View usage and adoption metrics.",
      },
      {
        code: "VIEW_SYSTEM_HEALTH",
        label: "View System Health",
        description: "View system health and configuration status.",
        highRisk: true,
      },
      {
        code: "VIEW_BACKGROUND_JOBS",
        label: "View Background Jobs",
        description: "View admin job run history.",
      },
      {
        code: "VIEW_BACKUP_STATUS",
        label: "View Backup Status",
        description: "View backup visibility and limitations.",
      },
      {
        code: "VIEW_VERSION_INFORMATION",
        label: "View Version Information",
        description: "View application version and deployment metadata.",
      },
      {
        code: "EXPORT_OPERATIONAL_DATA",
        label: "Export Operational Data",
        description: "Export customers, machines, parts, and service calls.",
        highRisk: true,
      },
      {
        code: "IMPORT_OPERATIONAL_DATA",
        label: "Import Operational Data",
        description: "Import customers and parts with validation.",
        highRisk: true,
      },
      {
        code: "VIEW_INTEGRATIONS",
        label: "View Integrations",
        description: "View configured integrations without secrets.",
      },
      {
        code: "VIEW_ADMIN_TOOLS",
        label: "View Admin Tools",
        description: "Access safe administrative maintenance tools.",
        highRisk: true,
      },
      {
        code: "RUN_DATA_VALIDATION",
        label: "Run Data Validation",
        description: "Run scan-only relationship and duplicate checks.",
      },
      {
        code: "MANAGE_ANNOUNCEMENTS",
        label: "Manage Announcements",
        description: "Create Service Hub announcements.",
      },
      {
        code: "COMPLETE_ACCESS_REVIEW",
        label: "Complete Access Reviews",
        description: "Record periodic access review decisions.",
        highRisk: true,
      },
    ],
  },
];
