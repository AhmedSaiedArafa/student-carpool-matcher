#!/usr/bin/env bash
# Lab 7, Part 6: invoke the Lambda function with every saved event in backend/events/
# and compare the statusCode with the expected one.
# Run from the project folder in Git Bash:   bash infra/floci/test-events.sh
set -uo pipefail
export AWS_PROFILE="${AWS_PROFILE:-floci}"

# Use the "floci" AWS profile from the Quick Installation Guide (create it if missing).
if ! aws configure get endpoint_url --profile floci >/dev/null 2>&1; then
  aws configure set aws_access_key_id test --profile floci
  aws configure set aws_secret_access_key test --profile floci
  aws configure set region us-east-1 --profile floci
  aws configure set endpoint_url http://localhost:4566 --profile floci
  echo "Created the AWS profile 'floci' (endpoint http://localhost:4566)."
fi
FUNCTION=carpool-api
mkdir -p out

declare -A EXPECTED=(
  [1-health]=200
  [2-login]=200
  [3-login-invalid]=400
  [4-no-token]=401
  [5-unknown-route]=404
  [6-matches-missing-params]=401
  [7-stats]=200
)

passed=0; failed=0
for file in backend/events/*.json; do
  name=$(basename "$file" .json)
  aws lambda invoke --function-name "$FUNCTION" --payload "file://$file" \
    --cli-binary-format raw-in-base64-out "out/$name.json" >/dev/null
  status=$(grep -o '"statusCode": *[0-9]*' "out/$name.json" | grep -o '[0-9]*$')
  want=${EXPECTED[$name]:-?}
  if [ "$status" = "$want" ]; then
    echo "PASS  $name  (statusCode $status)"; passed=$((passed+1))
  else
    echo "FAIL  $name  (expected $want, got ${status:-none}) -> see out/$name.json"; failed=$((failed+1))
  fi
done
echo "Passed: $passed   Failed: $failed"
[ "$failed" -eq 0 ]
