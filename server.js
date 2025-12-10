// server.js - minimal Smart Home test server
const express = require('express');
const bodyParser = require('body-parser');
const querystring = require('querystring');

const app = express();
app.use(bodyParser.json());
const PORT = process.env.PORT || 8080; // Cloud Run uses 8080 by default

// ---- In-memory "database" for demo ----
const fakeCodes = {};      // code -> userid
const fakeTokens = {};     // access_token -> userid

// ---- Authorization endpoint (OAuth2) ----
app.get('/oauth/authorize', (req, res) => {
  const {redirect_uri, state, client_id, response_type} = req.query;
  const code = 'code-' + Math.random().toString(36).substring(2,10);
  fakeCodes[code] = {userid: 'test-user-1'};
  const redirect = `${redirect_uri}?${querystring.stringify({code, state})}`;
  console.log('[OAUTH] Authorize called. Redirecting to:', redirect);
  res.redirect(redirect);
});

// ---- Token endpoint (OAuth2) ----
app.post('/oauth/token', (req, res) => {
  const body = req.body || {};
  const grant_type = body.grant_type || req.query.grant_type;
  if (grant_type === 'authorization_code') {
    const code = body.code || req.query.code;
    if (!fakeCodes[code]) return res.status(400).json({error: 'invalid_grant'});
    const access_token = 'access-' + Math.random().toString(36).substring(2,12);
    fakeTokens[access_token] = fakeCodes[code].userid;
    console.log('[OAUTH] Exchanged code for token:', access_token);
    return res.json({
      token_type: 'bearer',
      access_token,
      refresh_token: 'refresh-' + Math.random().toString(36).substring(2,12),
      expires_in: 3600
    });
  }
  if (grant_type === 'refresh_token') {
    const access_token = 'access-' + Math.random().toString(36).substring(2,12);
    fakeTokens[access_token] = 'test-user-1';
    return res.json({token_type:'bearer', access_token, expires_in:3600});
  }
  res.status(400).json({error:'unsupported_grant_type'});
});

// ---- Smart Home fulfillment endpoint ----
app.post('/smarthome', (req, res) => {
  console.log('--- /smarthome called ---');
  console.log(JSON.stringify(req.body, null, 2));

  const inputs = req.body.inputs || [];
  for (const input of inputs) {
    if (input.intent === 'action.devices.SYNC') {
      const response = {
        requestId: req.body.requestId || 'req-1',
        payload: {
          agentUserId: 'test-user-1',
          devices: [{
            id: 'light-123',
            type: 'action.devices.types.LIGHT',
            traits: ['action.devices.traits.OnOff'],
            name: {name: 'Test Light'},
            willReportState: false,
            deviceInfo: {manufacturer: 'Demo', model: 'light.v1', hwVersion: '1', swVersion: '1'}
          }]
        }
      };
      return res.json(response);
    } else if (input.intent === 'action.devices.QUERY') {
      const devices = input.payload.devices || [];
      const deviceStates = {};
      devices.forEach(d => deviceStates[d.id] = {on: false});
      return res.json({requestId: req.body.requestId, payload: {devices: deviceStates}});
    } else if (input.intent === 'action.devices.EXECUTE') {
      const commands = input.payload.commands || [];
      const results = [];
      for (const cmd of commands) {
        const ids = cmd.devices.map(d => d.id);
        cmd.execution.forEach(exec => {
          console.log('[EXECUTE] execution:', exec);
        });
        results.push({
          ids,
          status: 'SUCCESS',
          states: {on: true}
        });
      }
      return res.json({requestId: req.body.requestId, payload: {commands: results}});
    }
  }
  res.json({requestId: req.body.requestId || 'req', payload: {}});
});

app.get('/', (req, res) => res.send('SmartHome test server OK'));

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));