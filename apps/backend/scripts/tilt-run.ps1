$envFile = "apps/backend/.env"

if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*(#.*)?$') {
      return
    }

    $name, $value = $_ -split '=', 2
    Set-Item -Path "Env:$name" -Value $value
  }
}

Set-Location "apps/backend"
mvn yamcs:run
