package com.lifepilot.ai.domain.model

enum class RiskLevel { LOW, MEDIUM, HIGH }

enum class StepStatus {
    PENDING,
    PLANNING,
    RUNNING,
    WAITING_FOR_APPROVAL,
    COMPLETED,
    FAILED
}

enum class WorkflowStatus {
    ACTIVE,
    WAITING_FOR_APPROVAL,
    PAUSED,
    COMPLETED,
    FAILED,
    CANCELLED
}

data class WorkflowStep(
    val id: String,
    val order: Int,
    val title: String,
    val description: String,
    val toolName: String,
    val riskLevel: RiskLevel,
    val requiresApproval: Boolean,
    val status: StepStatus,
    val actionSummary: String? = null,
    val outputNote: String? = null
)

data class Workflow(
    val id: String,
    val title: String,
    val userGoal: String,
    val understoodIntent: String,
    val status: WorkflowStatus,
    val steps: List<WorkflowStep>,
    val updatedAtIso: String
)
