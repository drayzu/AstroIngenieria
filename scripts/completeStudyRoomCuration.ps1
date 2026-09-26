$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$root = (Resolve-Path -LiteralPath (Join-Path $workspace 'output/study-room-curation')).Path
$indexPath = Join-Path $root 'INDICE.json'
$index = Get-Content -LiteralPath $indexPath -Raw | ConvertFrom-Json -AsHashtable
$plan = node (Join-Path $PSScriptRoot 'alignStudyRoomCuration.mjs') --plan | ConvertFrom-Json -AsHashtable
if ($LASTEXITCODE -ne 0 -or $plan.Count -ne 106) { throw 'El plan editorial no contiene 106 obras.' }

function SafePath([string]$relative) {
  $absolute = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
  if (-not $absolute.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Ruta fuera de la colección: $relative"
  }
  return $absolute
}
function Renumber([string]$name, [string]$oldNumber, [string]$newNumber) {
  return $name -creplace ('^' + [regex]::Escape($oldNumber) + '-'), ($newNumber + '-')
}

$stage = SafePath '.reorganizacion-editorial'
if (-not (Test-Path -LiteralPath $stage)) { New-Item -ItemType Directory -Path $stage | Out-Null }
$expectedStageNames = @($plan | ForEach-Object { "$($_.oldNumber)-$($_.id)" })
foreach ($entry in Get-ChildItem -LiteralPath $stage -Force) {
  if ($entry.Name -notin $expectedStageNames) { throw "Elemento inesperado en la zona temporal: $($entry.Name)" }
}

# Validar todas las carpetas antes de continuar con los movimientos.
foreach ($item in $plan) {
  $old = SafePath $item.oldFolder
  $staged = SafePath ('.reorganizacion-editorial/' + $item.oldNumber + '-' + $item.id)
  $target = SafePath $item.newFolder
  if (-not (Test-Path -LiteralPath $old) -and -not (Test-Path -LiteralPath $staged)) { throw "Falta $($item.id)" }
  if ($target -ne $old -and (Test-Path -LiteralPath $target)) { throw "El destino ya existe: $target" }
}

foreach ($item in $plan) {
  $old = SafePath $item.oldFolder
  $staged = SafePath ('.reorganizacion-editorial/' + $item.oldNumber + '-' + $item.id)
  if (-not (Test-Path -LiteralPath $staged)) { Move-Item -LiteralPath $old -Destination $staged }
}

$oldChapters = @($plan | ForEach-Object { Split-Path -Path (SafePath $_.oldFolder) -Parent } | Select-Object -Unique)
foreach ($chapter in $oldChapters) {
  if ((Get-ChildItem -LiteralPath $chapter -Force | Measure-Object).Count -ne 0) { throw "Capítulo antiguo no vacío: $chapter" }
  Remove-Item -LiteralPath $chapter
}
$newChapters = @($plan | ForEach-Object { Split-Path -Path (SafePath $_.newFolder) -Parent } | Select-Object -Unique)
foreach ($chapter in $newChapters) { New-Item -ItemType Directory -Force -Path $chapter | Out-Null }

foreach ($item in $plan) {
  $staged = SafePath ('.reorganizacion-editorial/' + $item.oldNumber + '-' + $item.id)
  foreach ($folder in @($staged, (Join-Path $staged 'elegida'), (Join-Path $staged 'basura'))) {
    foreach ($file in Get-ChildItem -LiteralPath $folder -File) {
      $newName = Renumber $file.Name $item.oldNumber $item.newNumber
      if ($newName -cne $file.Name) { Rename-Item -LiteralPath $file.FullName -NewName $newName }
    }
  }
  Move-Item -LiteralPath $staged -Destination (SafePath $item.newFolder)
}
Remove-Item -LiteralPath $stage

$roomById = @{}
foreach ($room in $index.rooms) { $roomById[$room.id] = $room }
$renumber = @{}
$newRooms = @($roomById['recursos-del-sitio'])
foreach ($item in $plan) {
  $room = $roomById[$item.id]
  $renumber[$item.oldNumber] = $item.newNumber
  $room.originalNumber = $item.oldNumber
  $room.number = $item.newNumber
  $room.chapter = $item.chapterId
  $room.folder = $item.newFolder
  foreach ($image in $room.images) {
    $image.image = Renumber $image.image $item.oldNumber $item.newNumber
    $image.prompts = @($image.prompts | ForEach-Object { Renumber $_ $item.oldNumber $item.newNumber })
  }
  $room.promptsWithoutImage = @($room.promptsWithoutImage | ForEach-Object { Renumber $_ $item.oldNumber $item.newNumber })
  $newRooms += $room
}
foreach ($record in $index.recoveredFromRecords) {
  if (-not $record.ContainsKey('sourceImage')) { $record.sourceImage = $record.image }
  if ($record.image -match '^(\d{3})-' -and $renumber.ContainsKey($Matches[1])) {
    $record.image = Renumber $record.image $Matches[1] $renumber[$Matches[1]]
  }
  if ($record.prompt -match '^(\d{3})-' -and $renumber.ContainsKey($Matches[1])) {
    $record.prompt = Renumber $record.prompt $Matches[1] $renumber[$Matches[1]]
  }
}
$index.layout = 'editorialJourney'
$index.rooms = $newRooms
$json = $index | ConvertTo-Json -Depth 100
Set-Content -LiteralPath $indexPath -Value $json -Encoding utf8
Write-Host "Organizadas $($plan.Count) obras según el recorrido editorial."
