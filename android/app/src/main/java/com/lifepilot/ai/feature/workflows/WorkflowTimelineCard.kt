package com.lifepilot.ai.feature.workflows

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.lifepilot.ai.domain.model.StepStatus
import com.lifepilot.ai.domain.model.Workflow

@Composable
fun WorkflowTimelineCard(
    workflow: Workflow,
    onApprove: (workflowId: String, stepId: String) -> Unit,
    onEdit: (workflowId: String, stepId: String) -> Unit,
    onReject: (workflowId: String, stepId: String) -> Unit,
    modifier: Modifier = Modifier
) {
    OutlinedCard(modifier = modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(text = workflow.title, style = MaterialTheme.typography.titleLarge)
            Text(
                text = "AI understood: ${workflow.understoodIntent}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            HorizontalDivider()
            LazyColumn(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                items(workflow.steps, key = { it.id }) { step ->
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = "${step.order}. ${step.title} · ${step.status.name} · ${step.riskLevel.name} risk",
                            style = MaterialTheme.typography.titleSmall
                        )
                        Text(text = step.description, style = MaterialTheme.typography.bodySmall)
                        if (step.status == StepStatus.WAITING_FOR_APPROVAL) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(
                                    onClick = { onApprove(workflow.id, step.id) },
                                    modifier = Modifier.semantics {
                                        contentDescription = "Approve ${step.title}"
                                    }
                                ) {
                                    Text("Approve")
                                }
                                OutlinedButton(onClick = { onEdit(workflow.id, step.id) }) {
                                    Text("Edit")
                                }
                                OutlinedButton(onClick = { onReject(workflow.id, step.id) }) {
                                    Text("Reject")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
