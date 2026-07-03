param(
    [Parameter(Mandatory = $true)]
    [string]$UserId,

    [Parameter(Mandatory = $true)]
    [string]$MqttHost,

    [Parameter(Mandatory = $true)]
    [int]$MqttPort,

    [string]$Address = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Set-Location $PSScriptRoot

$python = Get-Command python -ErrorAction SilentlyContinue
if ($null -eq $python) {
    $python = Get-Command py -ErrorAction SilentlyContinue
}

if ($null -eq $python) {
    throw "Python was not found on PATH. Install Python 3 or make the 'python'/'py' launcher available."
}

if (!(Test-Path venv)) {
    if ($python.Name -eq "py.exe") {
        & $python.Source -3 -m venv venv
    } else {
        & $python.Source -m venv venv
    }
}

$venvPython = Join-Path $PSScriptRoot "venv\Scripts\python.exe"
if (!(Test-Path $venvPython)) {
    throw "Virtualenv Python was not created at $venvPython"
}

& $venvPython -m pip install -r requirements.txt

$scriptArgs = @(
    "ecoflow_delta2_max_mqtt.py",
    "--user-id", $UserId,
    "--mqtt-host", $MqttHost,
    "--mqtt-port", $MqttPort
)

if ($Address -ne "") {
    $scriptArgs += @("--address", $Address)
}

& $venvPython -u @scriptArgs
