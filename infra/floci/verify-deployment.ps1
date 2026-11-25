<#
.SYNOPSIS
  Check that the deployed API works and that security rules are enforced.
  Owner: Youssef (security and testing)
#>
. "$PSScriptRoot\_settings.ps1"

$API = "$(Get-ApiUrl)/api"
$passed = 0
$failed = 0

function Test-Call($name, $method, $path, $expectedStatus, $body = $null, $token = $null) {
    $headers = @{ "Content-Type" = "application/json" }
    if ($token) { $headers["Authorization"] = "Bearer $token" }
    $params = @{ Uri = "$API$path"; Method = $method; Headers = $headers; TimeoutSec = 30 }
    if ($body) { $params["Body"] = ($body | ConvertTo-Json -Compress) }

    $status = $null
    $response = $null
    try {
        $response = Invoke-RestMethod @params
        $status = 200
        if ($method -eq "POST") { $status = 201 }
    } catch {
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    }

    $ok = ($expectedStatus -contains $status)
    if ($ok) {
        Write-Host "  PASS  $name (got $status)" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "  FAIL  $name (expected $($expectedStatus -join '/'), got $status)" -ForegroundColor Red
        $script:failed++
    }
    return $response
}

Write-Step "Verifying deployment at $API"

Test-Call "Health check" "GET" "/health" @(200) | Out-Null

$login = Test-Call "Login with seeded driver" "POST" "/auth/login" @(200, 201) `
    @{ university_email = "driver1@university.edu"; password = "Password123!" }
$token = $null
if ($login) { $token = $login.token; if (-not $token -and $login.data) { $token = $login.data.token } }

Test-Call "Protected endpoint without token -> 401" "GET" "/requests/mine" @(401) | Out-Null
Test-Call "Invalid login -> 400/401" "POST" "/auth/login" @(400, 401) `
    @{ university_email = "driver1@university.edu"; password = "wrong-password" } | Out-Null

if ($token) {
    Test-Call "Driver dashboard with token" "GET" "/drivers/dashboard" @(200) $null $token | Out-Null
    Test-Call "Editing a ride that does not exist -> 403/404" "PATCH" "/rides/999999" @(403, 404) `
        @{ seats_total = 3 } $token | Out-Null
} else {
    Write-Host "  SKIP  token-based checks (login failed)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Passed: $passed   Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
if ($failed -gt 0) { exit 1 }
