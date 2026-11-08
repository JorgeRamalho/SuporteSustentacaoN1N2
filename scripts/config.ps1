# Endereços oficiais do laboratório Sentinela (única origem do console).
$script:SentinelaConsoleHost = "127.0.0.1"
$script:SentinelaConsolePort = 5500
$script:SentinelaApiHost = "127.0.0.1"
$script:SentinelaApiPort = 8010
$script:SentinelaConsoleUrl = "http://${SentinelaConsoleHost}:${SentinelaConsolePort}/index.html"
$script:SentinelaApiHealthUrl = "http://${SentinelaApiHost}:${SentinelaApiPort}/api/health"
