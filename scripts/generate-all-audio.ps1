Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = 0
$audioDir = Join-Path $PSScriptRoot "..\content\audio"
if (-not (Test-Path $audioDir)) { New-Item -ItemType Directory -Path $audioDir | Out-Null }

$itemsDir = Join-Path $PSScriptRoot "..\content\items"
$parts = @("E", "F", "G", "H", "J")

Write-Host "Synthesizing authentic voice WAV files for listening parts..."

foreach ($part in $parts) {
    $file = Join-Path $itemsDir "$part.json"
    if (-not (Test-Path $file)) { continue }
    $items = Get-Content $file -Raw | ConvertFrom-Json
    
    foreach ($item in $items) {
        $id = $item.id
        $text = ""
        
        if ($part -eq "E" -or $part -eq "H") {
            $text = $item.content.text
            $wavPath = Join-Path $audioDir "$id.wav"
            $synth.SetOutputToWaveFile($wavPath)
            $synth.Speak($text)
        } elseif ($part -eq "F") {
            $text = $item.content.prompt
            $wavPath = Join-Path $audioDir "$id.wav"
            $synth.SetOutputToWaveFile($wavPath)
            $synth.Speak($text)
        } elseif ($part -eq "J") {
            $text = $item.content.story
            $wavPath = Join-Path $audioDir "$id.wav"
            $synth.SetOutputToWaveFile($wavPath)
            $synth.Speak($text)
        } elseif ($part -eq "G") {
            # Passage story
            $storyWav = Join-Path $audioDir "$id.wav"
            $synth.SetOutputToWaveFile($storyWav)
            $synth.Speak($item.content.story)
            
            # Sub-questions
            if ($item.content.questions) {
                for ($i = 0; $i -lt $item.content.questions.Count; $i++) {
                    $qText = $item.content.questions[$i].q
                    $qWav = Join-Path $audioDir "${id}_$i.wav"
                    $synth.SetOutputToWaveFile($qWav)
                    $synth.Speak($qText)
                }
            }
        }
    }
}

$synth.Dispose()
Write-Host "All listening audio files successfully generated in content/audio!"
