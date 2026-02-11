import React from 'react';
import { useEffect, useState } from 'react';
import axios from 'axios';

const InstructorDashboard = () => {
  const [upcomingLessons, setUpcomingLessons] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await axios.get('/api/instructor/dashboard');
        setUpcomingLessons(response.data.upcomingLessons);
        setPendingRequests(response.data.pendingRequests);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div>
      <h1>Instructor Dashboard</h1>
      <h2>Upcoming Lessons</h2>
      <ul>
        {upcomingLessons.map((lesson) => (
          <li key={lesson.id}>{lesson.studentName} - {new Date(lesson.startTime).toLocaleString()}</li>
        ))}
      </ul>
      <h2>Pending Requests</h2>
      <ul>
        {pendingRequests.map((request) => (
          <li key={request.id}>{request.studentName} - {request.requestedTime}</li>
        ))}
      </ul>
    </div>
  );
};

export default InstructorDashboard;
