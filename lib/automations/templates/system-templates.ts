/**
 * Patch 51A.2 — System automation templates (definitions only, no fake ops data).
 */

export const SYSTEM_TEMPLATES = [
  {
    name: "Machine-Down Emergency Escalation",
    description: "Escalate new service calls that look like machine-down emergencies.",
    category: "Service",
    icon: "alert",
    definition: {
      triggerType: "EVENT",
      eventType: "service_call.created",
      conditionMode: "ANY",
      conditions: {
        mode: "ANY",
        conditions: [
          { field: "priority", operator: "equals", value: "CRITICAL" },
          {
            field: "problemDescription",
            operator: "ai_classification",
            value: "machine-down",
            minConfidence: 0.7,
          },
        ],
      },
      actions: [
        { actionKey: "notification.dashboard_alert", params: { title: "Machine-down escalation" } },
        { actionKey: "notification.notify_role", params: { title: "Notify manager" } },
        { actionKey: "ai.generate_summary" },
      ],
      approvalMode: "NONE",
      riskLevel: "MEDIUM",
    },
  },
  {
    name: "PM Due Soon",
    description: "Daily reminder for PMs approaching due.",
    category: "PM",
    icon: "calendar",
    definition: {
      triggerType: "SCHEDULE",
      scheduleExpression: "daily",
      eventType: "pm.due_soon",
      conditions: { mode: "ALL", conditions: [] },
      actions: [
        { actionKey: "pm.create_reminder" },
        { actionKey: "notification.dashboard_alert", params: { title: "PM due soon" } },
      ],
      approvalMode: "NONE",
      riskLevel: "LOW",
    },
  },
  {
    name: "Overdue PM Escalation",
    description: "Escalate overdue PM items.",
    category: "PM",
    icon: "clock",
    definition: {
      triggerType: "EVENT",
      eventType: "pm.overdue",
      conditions: { mode: "ALL", conditions: [] },
      actions: [
        { actionKey: "pm.flag_urgent" },
        { actionKey: "notification.notify_role", params: { title: "Overdue PM" } },
        { actionKey: "task.create_follow_up" },
      ],
      approvalMode: "NONE",
      riskLevel: "MEDIUM",
    },
  },
  {
    name: "Missing Meter Reading",
    description: "Flag machines missing recent meter activity.",
    category: "PM",
    icon: "gauge",
    definition: {
      triggerType: "SCHEDULE",
      scheduleExpression: "daily",
      conditions: { mode: "ALL", conditions: [] },
      actions: [
        { actionKey: "data_quality.create_issue" },
        { actionKey: "notification.notify_role" },
      ],
      approvalMode: "NONE",
      riskLevel: "LOW",
    },
  },
  {
    name: "Low Inventory Alert",
    description: "Notify on low stock without placing orders.",
    category: "Inventory",
    icon: "box",
    definition: {
      triggerType: "EVENT",
      eventType: "inventory.low_stock",
      conditions: { mode: "ALL", conditions: [] },
      actions: [
        { actionKey: "inventory.notify_manager" },
        { actionKey: "inventory.reorder_recommendation" },
        { actionKey: "notification.dashboard_alert" },
      ],
      approvalMode: "NONE",
      riskLevel: "LOW",
    },
  },
  {
    name: "Emergency Parts Request",
    description: "Notify and require approval path for emergency parts.",
    category: "Inventory",
    icon: "truck",
    definition: {
      triggerType: "EVENT",
      eventType: "part.request_created",
      conditions: { mode: "ALL", conditions: [] },
      actions: [
        { actionKey: "notification.notify_role" },
        { actionKey: "ai.generate_summary" },
      ],
      approvalMode: "BEFORE_HIGH_IMPACT_ACTION",
      riskLevel: "HIGH",
    },
  },
  {
    name: "Service Call Follow-Up",
    description: "After close, draft follow-up communication (approval before send).",
    category: "Service",
    icon: "message",
    definition: {
      triggerType: "EVENT",
      eventType: "service_call.closed",
      conditions: {
        mode: "ANY",
        conditions: [
          { field: "priority", operator: "is_in", value: ["HIGH", "CRITICAL"] },
        ],
      },
      actions: [
        { actionKey: "task.create_follow_up" },
        { actionKey: "ai.draft_customer_communication", highImpact: true },
      ],
      approvalMode: "BEFORE_HIGH_IMPACT_ACTION",
      riskLevel: "HIGH",
    },
  },
  {
    name: "Critical System Error",
    description: "Notify admins on critical system events.",
    category: "Admin",
    icon: "shield",
    definition: {
      triggerType: "EVENT",
      eventType: "system_log.critical_event",
      conditions: { mode: "ALL", conditions: [] },
      actions: [
        { actionKey: "notification.dashboard_alert" },
        { actionKey: "task.create_follow_up" },
        { actionKey: "ai.generate_summary" },
      ],
      approvalMode: "NONE",
      riskLevel: "HIGH",
    },
  },
  {
    name: "Data Quality Review",
    description: "Route new DQ issues to review.",
    category: "Admin",
    icon: "search",
    definition: {
      triggerType: "EVENT",
      eventType: "data_quality.issue_detected",
      conditions: { mode: "ALL", conditions: [] },
      actions: [
        { actionKey: "data_quality.create_issue" },
        { actionKey: "notification.notify_role" },
        { actionKey: "ai.generate_summary" },
      ],
      approvalMode: "NONE",
      riskLevel: "LOW",
    },
  },
  {
    name: "Stale Service Call",
    description: "Escalate open service calls with no recent updates.",
    category: "Service",
    icon: "hourglass",
    definition: {
      triggerType: "SCHEDULE",
      scheduleExpression: "hourly",
      eventType: "service_call.overdue",
      conditions: {
        mode: "ALL",
        conditions: [
          { field: "updatedAt", operator: "older_than_hours", value: 24 },
        ],
      },
      actions: [
        { actionKey: "notification.notify_role" },
        { actionKey: "task.create_follow_up" },
      ],
      approvalMode: "NONE",
      riskLevel: "MEDIUM",
    },
  },
  // Patch 51A.3 — Predictive templates (safe / internal only)
  {
    name: "Critical Machine Risk",
    description: "Internal alert when predictive scoring marks a machine critical.",
    category: "Predictive",
    icon: "alert",
    definition: {
      triggerType: "EVENT",
      eventType: "predictive.machine_critical_risk",
      conditions: { mode: "ALL", conditions: [] },
      actions: [
        { actionKey: "notification.dashboard_alert", params: { title: "Critical predictive risk" } },
        { actionKey: "notification.notify_role", params: { title: "Notify manager" } },
        { actionKey: "ai.generate_summary" },
      ],
      approvalMode: "NONE",
      riskLevel: "HIGH",
    },
  },
  {
    name: "PM Window Opened",
    description: "Remind technicians when a predicted maintenance window opens.",
    category: "Predictive",
    icon: "calendar",
    definition: {
      triggerType: "EVENT",
      eventType: "predictive.maintenance_window_opened",
      conditions: { mode: "ALL", conditions: [] },
      actions: [
        { actionKey: "pm.create_reminder" },
        { actionKey: "notification.notify_role", params: { title: "PM window opened" } },
        { actionKey: "task.create_follow_up" },
      ],
      approvalMode: "NONE",
      riskLevel: "LOW",
    },
  },
  {
    name: "Repeat Failure Review",
    description: "Create a review task when repeat failure is detected.",
    category: "Predictive",
    icon: "search",
    definition: {
      triggerType: "EVENT",
      eventType: "predictive.repeat_failure_detected",
      conditions: { mode: "ALL", conditions: [] },
      actions: [
        { actionKey: "task.create_follow_up" },
        { actionKey: "notification.notify_role", params: { title: "Repeat failure review" } },
        { actionKey: "ai.generate_summary" },
      ],
      approvalMode: "NONE",
      riskLevel: "MEDIUM",
    },
  },
  {
    name: "Low Predictive Data Quality",
    description: "Flag machines that lack trustworthy data for prediction.",
    category: "Predictive",
    icon: "gauge",
    definition: {
      triggerType: "EVENT",
      eventType: "predictive.data_quality_low",
      conditions: { mode: "ALL", conditions: [] },
      actions: [
        { actionKey: "data_quality.create_issue" },
        { actionKey: "notification.notify_role" },
      ],
      approvalMode: "NONE",
      riskLevel: "LOW",
    },
  },
  // Patch 51A.4
  {
    name: "Daily Decision Engine Refresh",
    description:
      "Refresh enterprise decision recommendations without auto-executing high-impact actions.",
    category: "Decisions",
    icon: "refresh",
    definition: {
      triggerType: "SCHEDULE",
      eventType: "decision.daily_refresh",
      conditions: { mode: "ALL", conditions: [] },
      actions: [
        { actionKey: "decision.refresh_batch" },
        {
          actionKey: "notification.notify_role",
          params: { title: "Decision engine refreshed" },
        },
      ],
      approvalMode: "NONE",
      riskLevel: "LOW",
    },
  },
  {
    name: "Predictive Risk → Decision",
    description:
      "When a machine is critical predictive risk, create/refresh a decision recommendation.",
    category: "Decisions",
    icon: "decision",
    definition: {
      triggerType: "EVENT",
      eventType: "predictive.machine_critical_risk",
      conditions: { mode: "ALL", conditions: [] },
      actions: [
        { actionKey: "decision.from_predictive" },
        {
          actionKey: "notification.dashboard_alert",
          params: { title: "Critical predictive decision created" },
        },
      ],
      approvalMode: "NONE",
      riskLevel: "MEDIUM",
    },
  },
] as const;
