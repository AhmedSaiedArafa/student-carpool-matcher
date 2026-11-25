<#
.SYNOPSIS
  Show the API's CloudWatch logs. Use -Follow to keep watching new logs.
  Owner: Youssef (logging and monitoring)

.EXAMPLE
  .\infra\floci\logs.ps1
  .\infra\floci\logs.ps1 -Follow
#>
param(
    [switch]$Follow,
    [string]$Since = "30m"
)
. "$PSScriptRoot\_settings.ps1"

Write-Step "CloudWatch logs for $LOG_GROUP (last $Since)"
if ($Follow) {
    aws logs tail $LOG_GROUP --since $Since --follow
} else {
    aws logs tail $LOG_GROUP --since $Since
}
