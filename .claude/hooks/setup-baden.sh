#!/bin/bash
cat > /tmp/baden-depix << 'SCRIPT'
#!/bin/bash
curl -s -X POST http://localhost:3800/api/query \
-H 'Content-Type: application/json' \
-d "{\"projectName\":\"depix\",$1}"
SCRIPT
chmod +x /tmp/baden-depix
