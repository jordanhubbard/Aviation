# Learner Scoring Metrics Design

## Overview
This document outlines the design of scoring metrics for evaluating learner performance in aviation training scenarios.

## Metrics

### Accuracy
- **Definition**: Measures how closely the learner's actions match the expected outcomes.
- **Scenarios**: Applied to tasks like maintaining altitude, heading, and speed.
- **Scoring Rubric**: 
  - 90-100%: Excellent
  - 75-89%: Good
  - 50-74%: Needs Improvement
  - Below 50%: Poor

### Timing
- **Definition**: Evaluates the timeliness of the learner's actions.
- **Scenarios**: Critical for tasks like decision-making at DA (Decision Altitude) or executing go-arounds.
- **Scoring Rubric**:
  - On Time: Excellent
  - Slight Delay: Good
  - Noticeable Delay: Needs Improvement
  - Significant Delay: Poor

### Safety
- **Definition**: Assesses the safety of the learner's actions and decisions.
- **Scenarios**: Includes emergency procedures and adherence to safety protocols.
- **Scoring Rubric**:
  - Safe: Excellent
  - Minor Safety Concerns: Good
  - Moderate Safety Concerns: Needs Improvement
  - Major Safety Concerns: Poor

## Mapping Metrics to Scenario Events
- **Pattern Work**: Accuracy in maintaining pattern altitude, timing in executing go-arounds, safety in approach and landing.
- **GPS Approach**: Accuracy in following glidepath, timing in DA callout, safety in landing or missed approach.
- **Cross-Country**: Accuracy in navigation, timing in handling weather deviations, safety in arrival procedures.
- **Emergency**: Accuracy in responding to failures, timing in executing lost procedures, safety in diversions.

## Conclusion
These metrics provide a comprehensive framework for evaluating learner performance, ensuring a focus on accuracy, timing, and safety across various training scenarios.