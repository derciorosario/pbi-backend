const { EventRegistration, User, Event } = require("../models");
const { v4: uuidv4 } = require("uuid");
const { cache } = require("../utils/redis");

exports.createRegistration = async (req, res) => {
  try {
    const { eventId, numberOfPeople, reasonForAttending } = req.body;
    const userId = req.user.id;

    // Check if user is already registered for this event
    const existingRegistration = await EventRegistration.findOne({
      where: { userId, eventId }
    });

    if (existingRegistration) {
      return res.status(400).json({
        message: "You are already registered for this event"
      });
    }

    // Check if event exists and is not cancelled
    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check capacity if set
    if (event.capacity) {
      const currentRegistrations = await EventRegistration.count({
        where: { eventId, status: "confirmed" }
      });

     
      if (currentRegistrations + numberOfPeople > event.capacity) {
        return res.status(400).json({
          message: "Event is at full capacity"
        });
      }
    }

    // Create registration
    const registration = await EventRegistration.create({
      id: uuidv4(),
      userId,
      eventId,
      numberOfPeople,
      reasonForAttending,
      status: "pending" // or "confirmed" based on your business logic
    });

    // Fetch the created registration with associations
    const registrationWithDetails = await EventRegistration.findByPk(registration.id, {
      include: [
        {
          model: User,
          as: "registrant",
          attributes: ["id", "name", "email"]
        },
        {
          model: Event,
          as: "event",
          attributes: ["id", "title", "startAt", "locationType"]
        }
      ]
    });

    await cache.deleteKeys([ 
          ["feed", "events", req.user.id] 
    ]);
    await cache.deleteKeys([
           ["feed","all",req.user.id] 
    ]);

    res.status(201).json({
      message: "Registration submitted successfully",
      registration: registrationWithDetails
    });
  } catch (error) {
    console.error("Create registration error:", error);
    res.status(500).json({
      message: "Failed to create registration",
      error: error.message
    });
  }
};

exports.getUserRegistrations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, eventId } = req.query;

    const whereClause = { userId };
    if (status) whereClause.status = status;
    if (eventId) whereClause.eventId = eventId;

    const registrations = await EventRegistration.findAll({
      where: whereClause,
      include: [
        {
          model: Event,
          as: "event",
          attributes: ["id", "title", "description", "startAt", "endAt", "locationType", "city", "country"]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    res.json({ registrations });
  } catch (error) {
    console.error("Get user registrations error:", error);
    res.status(500).json({
      message: "Failed to fetch registrations",
      error: error.message
    });
  }
};

exports.getEventRegistrations = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    // Check if user is the event organizer
    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (event.organizerUserId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const registrations = await EventRegistration.findAll({
      where: { eventId },
      include: [
        {
          model: User,
          as: "registrant",
          attributes: ["id", "name", "email", "phone"]
        }
      ],
      order: [["createdAt", "ASC"]]
    });

    res.json({ registrations });
  } catch (error) {
    console.error("Get event registrations error:", error);
    res.status(500).json({
      message: "Failed to fetch registrations",
      error: error.message
    });
  }
};

exports.updateRegistrationStatus = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    const registration = await EventRegistration.findByPk(registrationId, {
      include: [
        {
          model: Event,
          as: "event"
        }
      ]
    });

    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    // Check if user is the event organizer
    if (registration.event.organizerUserId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Validate status
    if (!["pending", "confirmed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    await registration.update({ status });

    res.json({
      message: "Registration status updated successfully",
      registration
    });
  } catch (error) {
    console.error("Update registration status error:", error);
    res.status(500).json({
      message: "Failed to update registration status",
      error: error.message
    });
  }
};

exports.cancelRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const userId = req.user.id;

    const registration = await EventRegistration.findOne({
      where: { id: registrationId, userId }
    });

    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    await registration.update({ status: "cancelled" });

    res.json({ message: "Registration cancelled successfully" });
  } catch (error) {
    console.error("Cancel registration error:", error);
    res.status(500).json({
      message: "Failed to cancel registration",
      error: error.message
    });
  }
};