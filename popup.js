// Popup.js
import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Switch,
  FormControlLabel,
} from "@mui/material";

function Popup({ visits, dark, setDark }) {
  // Same analytics as above, simplified here
  const totalVisits = visits.length;
  const avgDuration = visits.length
    ? (
        visits.reduce(
          (acc, v) => acc + (new Date(v.closeTime) - new Date(v.openTime)),
          0
        ) /
        visits.length /
        1000
      ).toFixed(2)
    : 0;

  return (
    <div
      style={{
        padding: 16,
        width: 350,
        backgroundColor: dark ? "#121212" : "#fff",
      }}
    >
      <Typography variant="h5" gutterBottom>
        HUBAI User Activity
      </Typography>

      <FormControlLabel
        control={<Switch checked={dark} onChange={() => setDark(!dark)} />}
        label="Dark Mode"
      />

      <Grid container spacing={2} style={{ marginTop: 10 }}>
        <Grid item xs={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1">Total Sessions</Typography>
              <Typography variant="h6">{totalVisits}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1">Avg. Session (sec)</Typography>
              <Typography variant="h6">{avgDuration}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      {/* Add more cards as needed */}
    </div>
  );
}

export default Popup;
